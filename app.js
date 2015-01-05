
/**
 * Module dependencies.
 */
var express = require('express');
var path = require('path');
var session = require("express-session");
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var store = new session.MemoryStore();

var app = express();

var httpServer = require("http").Server(app);
var WebSocketServer = require("websocket").server;
var webSocketServer = new WebSocketServer({
  httpServer:httpServer,
  autoAcceptConnections:false,
  maxReceivedFrameSize: 64*1024*1024,   
  maxReceivedMessageSize: 64*1024*1024,
});

var signKey = "RHDwSKMa&vcxnkj";

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(cookieParser(signKey));
app.use(session({store:store}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended : true}));
app.use(express.static(path.join(__dirname, 'public')));

var sockets = [];
var camsocket;
webSocketServer.on('request', function(request) {
  var sid = "";
  for (var i = 0; i < request.cookies.length; i++) {
    if(request.cookies[i].name === "connect.sid"){
      sid = request.cookies[i].value;
    }
  };

  var sessionID = cookieParser.signedCookie(sid,signKey);

  store.get(sessionID, function(err,session){

    //WebSocket Endpoint fuer den Beobachter
    if(request.resource == "/watch"){
      var connection = request.accept();
      sockets.push(connection);
      connection.on("close", function(){
        delete connection;
      });
    }
    //WebSocket Endpoint fuer die Kamera
    else if(request.resource=="/cam"){
      //Schliessen der WebSocket-Verbindung, einer evtl. bereits verbundenen Kamera
      if(camsocket){
        camsocket.close();
      }
      camsocket = request.accept();
      camsocket.on("message", function(message){
        if(message.type=="binary"){
          for(var i = 0 ; i< sockets.length;i++){
            sockets[i].sendBytes(message.binaryData);
          }
        }
      });
      camsocket.on("close",function(){
        for(var i = 0 ; i< sockets.length;i++){
            sockets[i].sendUTF("Webcam closed");
          }
      });
    }
    else{
        request.reject();
    }
  });
});

function requiresLogin(req,res,next){
  if(!req.session.username){
    req.session.path = req.url;
    res.redirect('/login');
  }
  else{
    next();
  }
}

app.get('/login', function (req,res){
  res.render('login',{title:'Login'});
});

app.post('/login',function(req,res){
  if(req.body.username=="admin"&&req.body.password=="123"){
    var path = req.session.path;
    req.session.regenerate(function(err){
      var hour = 60*60*1000;
      req.session.username = req.body.username;
      req.session.cookie.expires = new Date(Date.now()+hour);

      if(path){
      res.redirect(path);
      }
      else{
        res.redirect("/watch");
      }
     });
  }
  else{
   res.redirect('back');
  }
});

app.get("/",function(req,res){
  res.redirect("/login");
});

app.get('/cam',requiresLogin,function (req,res){
  res.sendFile(__dirname+"/static/cam.html")
});

app.get("/watch",requiresLogin,function (req,res){
  res.sendFile(__dirname+"/static/watch.html")
});

app.get("/logout",function (req,res){
  req.session.destroy();
  res.redirect("/login");
});

httpServer.listen(3000, function (){
  console.log("Express-Server laeuft auf dem Port 3000");
});
