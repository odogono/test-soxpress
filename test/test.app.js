var app = require( '../app' );
var log = require('util').log;
var Step = require('step/lib/step');
var io = require('socket.io/node_modules/socket.io-client');
var request = require('supertest');
var assert = require('assert');
var utils = require('express/node_modules/connect').utils;

app.config.server.manualStart = true;

// provide simple setting of cookies from a response object
var Request = require('supertest/node_modules/superagent').Request;
Request.prototype.setCookies = function(res){
    var self = this;
    if( res && res.headers ){
        res.headers['set-cookie'].forEach( function(cookie){
            self.set('Cookie', cookie);
        });
    }
    return this;
}

var Cookie = require('express/node_modules/cookie');
var parseCookies = function(res,secret){
    var i, headers, cookie, key, value;
    var result = [];
    var cookies = (res && res.headers && res.headers['set-cookie']) ? res.headers['set-cookie'] : null;
    if( cookies ){
        for( i in cookies ){
            cookie = Cookie.parse( cookies[i] );
            if( secret ){
                for( key in cookie ){
                    cookie[key] = utils.parseSignedCookie( cookie[key], secret );
                }
            }
            result.push( cookie );
        }
    }
    return result;
}


describe('app', function(){
    
    /*it('app start/stop 1', function(done){
        log('----');
        app.config.server.manualStart = true;

        Step(
            function startApp(){
                app.start(this);
            },
            function(err){
                if( err ) throw err;
                log('started');
                var mockRes = { 
                    json: function(arg){
                        log('mockRes.json! ' + JSON.stringify(arguments) )
                    }
                };
                var route = app._router.match('get','/testroute',0);
                var res = route.callbacks[0](null,mockRes);
                app.stop(this);
            },
            function(err){
                if( err ) throw err;
                log('stopped');
                done();
            }
        );
    });//*/

    it('should connect', function(done){
        var sessionRequest;
        Step(
            function (){
                app.start(this);
            },
            function(){
                request(app)
                    .get('/login')
                    .end(this);
            },
            function(err,res){
                if( err ) throw err;
                var time, next = this;
                // store the response for use in later requests
                sessionRequest = res;                
                var addr = 'http://127.0.0.1:' + app.config.server.port + '?stok=' + res.body.stok;

                io.connect(addr).on('connect', function(data){
                    this.emit('set', 'name', 'boris' );
                    this.emit('ping', (time = Date.now()) );
                }).on('pong', function(time){
                    // log('roundtrip ' + (Date.now()-time) );
                    this.disconnect();
                    next();
                });
            },
            function(err){
                if( err ) throw err;
                request(app)
                    .get('/session')
                    .send({ get: 'name' })
                    // set cookies we received from earlier request to maintain the session
                    .setCookies(sessionRequest)
                    .end(this);
            },
            function(err,res){
                if( err ) throw err;
                assert.equal( res.body, 'boris');
                app.stop( done );
            }
        );
    });//*/

    it('should fail without token', function(done){
        Step(
            function startApp(){
                app.start(this);
            },
            function(err){
                if(err) throw err;
                request(app)
                    .get('/session')
                    .end(this);
            },
            function(err,res){
                if( err ) throw err;
                var time, next = this;
                var addr = 'http://127.0.0.1:' + app.config.server.port + '?stok=1';

                io.connect(addr).on('error', function(){
                    next();
                });
            },
            function(err){
                if( err ) throw err;
                app.stop( done );
            }
        );
    });//*/
});