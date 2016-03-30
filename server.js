var port = process.env.PORT || 5003;
var path = require("path");
var express = require("express")
var app = express();
var server = app.listen(port);
var io = require('socket.io')(server);

server.listen(port);


console.log('listening on port %d', port);

app.get('/', function (req, res) {
        res.sendFile(path.join(__dirname, "index.html"));
    }
);

process.env.PWD = process.cwd();
app.use(express.static(process.env.PWD + '/public'));
//app.use(express.static(__dirname + '/public'));


// Heroku setting for long polling - assuming io is the Socket.IO server object
/*io.configure(function () {
 io.set("transports", ["xhr-polling"]);
 io.set("polling duration", 10);
 });*/

io.on('connection', function (socket) {

    socket.on('offer', function (offer) {
        log('server received an offer: ');
        socket.broadcast.emit('offer', offer);
    });

    socket.on('entry', function (entry) {
        // log('A new Person connected succesfully to the server');
        socket.broadcast.emit('entry', entry);
    });

    socket.on('answer', function (answer) {
        log('server received an answer');
        socket.broadcast.emit('answer', answer);
    });

    socket.on('iceCandidate', function (candidate) {
        socket.broadcast.emit('iceCandidate', candidate);
    });

    socket.on('endSession', function (msg) {
        socket.broadcast.emit('endSession', msg);
    })

    function log() {
        var array = [">>> Message from server: "];
        for (var i = 0; i < arguments.length; i++) {
            array.push(arguments[i]);
        }
        socket.emit('log', array);
    }
});

