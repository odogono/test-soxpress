var log = require('util').log,
    inspect = require('util').inspect,
    http = require('http'),
    express = require('express'),
    connect = require('express/node_modules/connect'),
    Session = connect.middleware.session.Session,
    socketio = require('socket.io'),
    Step = require('step/lib/step'),
    sessionStore = new connect.session.MemoryStore(),
    app = module.exports = express();

// 
// Config
// 
var config = app.config = {
    server: {
        manualStart: true,
        port: 3010
    },
    session: {
        key: 'soxpress.id',
        secret: 'soxpress',
        store: sessionStore
    }
};


// 
// Debug printing
// 
print_ins = function(arg,showHidden,depth,colors){
    log( inspect(arg,showHidden,depth,colors) );
}

// 
// Returns the sessionID/session from a token by muddling through
// the internal private vars.
// 
var getSessionFromToken = function( sToken, returnId ){
    var session, sessions = sessionStore.sessions;
    for( var sessionId in sessions ){
        session = JSON.parse( sessions[sessionId] );
        if( session.sToken == sToken )
            return returnId ? sessionId : session;
    }
    return null;
}

app.configure( function(){
    // app.use( express.logger({ format: ":date\t:response-time\t:method :status\t\t:url" }) );
    app.use( express.cookieParser());
    app.use( express.session(config.session) );

    app.use( function ( req, res, next ){
        // set a token
        if( !req.session.sToken ){
            req.session.sToken = Math.floor(Math.random() * 65536).toString(16);
        }
        next();
    });
    app.use( app.router );
    app.use( express.errorHandler({ dumpExceptions:true, showStack:true }));
});

// 
// App Routes
// 

app.get('/login', function(req,res){
    res.json({id:req.session.id,stok:req.session.sToken});
});

app.get('/session', function(req,res){
    if( req.query.get ){
        res.json( req.session[req.query.get] );
    } else 
        res.json({id:req.session.id,stok:req.session.sToken});
});


// 
// App Startup/Shutdown
// 

var port = config.server.port;
var portInc = 0;

app.start = function(callback){
    if( process.env.NODE_ENV === 'test' )
        port += portInc;
    config.server.port = port;
    Step(
        function(){
            app.server.listen(port,this);
        },
        function(err){
            if( err ) throw err;
            portInc++;
            if( callback ) 
                callback();
        }
    );
}

app.stop = function(callback){
    app.server.close(function(){
        if( callback )
            callback(null,app.server);
    });
}



app.server = http.createServer(app);

if( !config.server.manualStart )
    app.start();



// 
// Socket IO initialisation
// 
var io = app.socketio = socketio.listen(app.server);

io.on('connection', function(client){
    var session = client.handshake.session;

    client
        .on('message', function(msg){
            log('received client message: ' + JSON.stringify(arguments) );        
        })
        .on('disconnect', function(){
            // log('disconnected');
        })
        .on('set', function(key,value){
            session[key] = value;
            session.touch().save(function(){
            });
            
        })
        .on('ping', function(time){
            this.emit('pong', time);
        });
});

io.configure(function(){

    io.set('log level', 1);
    io.set('transports', ['websocket']);

    io.set('authorization', function(data,accept){
        // look for the token that gets passed in the connection query string
        var token = (data.query && data.query.stok) ? data.query.stok : null;
        // look up session id from the token
        var sessionID = getSessionFromToken( token, true );

        if( sessionID ){
            data.sessionID = sessionID;
            data.sessionStore = sessionStore;
            data.sessionStore.get(data.sessionID, function (err, session) {
                if (err || !session){
                    accept('Error', false);
                } else {
                    data.session = new Session(data, session);
                    accept( null, true );
                }
            });
        } else {
            accept(null, false);
        }
    })
});