/**
 * Created by PouriaJafari on 25-3-2016.
 */


//shim for right api's
var peerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection ||
    window.webkitRTCPeerConnection || window.msRTCPeerConnection;
var sessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription ||
    window.webkitRTCSessionDescription || window.msRTCSessionDescription;

navigator.getUserMedia = navigator.getUserMedia || navigator.mozGetUserMedia ||
    navigator.webkitGetUserMedia || navigator.msGetUserMedia;


var btn1 = document.getElementById('btn1');
var btn2 = document.getElementById('btn2');
var btn3 = document.getElementById('btn3');

var clients = 1;


btn1.disabled = true;
btn2.disabled = true;
btn3.disabled = true;

var video = document.getElementById("localVideo");
var otherPeer = document.getElementById("remoteVideo");

// create PeerConnection configuration is google stun server open to public
var pc;
var sendmessage;
var dchannel;
var iceCandidates = [];

function setupPeerConnection() {
    var configuration = {
        iceServers: [
            {urls: "stun:stun.l.google.com:19302"},
        ]
    };

    var optionals = {
        optional: [{
            RtpDataChannels: true
        }]
    };

    pc = new peerConnection(configuration, optionals);

    pc.onaddstream = function (e) {
        otherPeer.src = URL.createObjectURL(e.stream);
    };

    pc.onicecandidate = function (e) {
        // candidate exists in e.candidate
        if (!e.candidate) return;
        console.log("IceCandidate has been added to webRTCPeerconnection", e);
        iceCandidates.push(new IceCandidate(e.candidate));
    };

}


function stop() {
    var videos = document.getElementsByTagName("video");
    for (var i = 0; i < videos.length; i++) {
        videos[i].pause();
    }
    pc.close();
    pc = null;
}

errorHandler = function (err) {
    console.log("error", err);
    //stop();
};

succesHandler = function (e) {
    console.log(e);
}


function sendOffer() {

    dchannel = pc.createDataChannel("dchannelofferer", {reliable: false});

    dchannel.onerror = function (err) {
        console.error(" Channel Error:", err);
    };
    dchannel.onmessage = function (msg) {
        console.info(" Datachannel recieved:", msg);
        addMessage(msg, "remote");
    };

    dchannel.onopen = function () {
        console.info(" DataCHannel is reaady WOHOO!");
        sendmessage = dchannel.send.bind(dchannel);
    }

    dchannel.onclose = function (e) {
        console.log("why", e);
    };

    var options = {
        offerToReceiveAudio: false,
        offerToReceiveVideo: false
    };

    pc.createOffer(function (offer) {
        pc.setLocalDescription(offer, function () {
            send("offer", JSON.stringify(offer));
            btn1.disabled = true;
        }, errorHandler);
    }, errorHandler, options);
}

function answer(offer) {

    pc.ondatachannel = function (ev) {
        console.info("succesful added datachannel connection", ev)

        ev.channel.onmessage = function (msg) {
            console.info("DataChannel received:", msg);
            addMessage(msg, "remote");
        };
        ev.channel.onopen = function () {
            sendmessage = ev.channel.send.bind(ev.channel);
            console.info("DataCHannel is reaady WOHOO!");
        }
    };

    var rsdp = new sessionDescription(offer);

    if (window.webkitRTCPeerConnection) {
        pc.setRemoteDescription(rsdp, function () {
            pc.createAnswer().then(function (asdp) {
                console.log(typeof asdp);
                pc.setLocalDescription(asdp, function () {
                    send("answer", JSON.stringify(pc.localDescription));
                }, errorHandler);
            }).error(errorHandler);
        }, errorHandler);
    }
    else {
        pc.setRemoteDescription(rsdp, function () {
            pc.createAnswer(function (asdp) {
                console.log(typeof asdp);
                pc.setLocalDescription(asdp, function () {
                    send("answer", JSON.stringify(pc.localDescription));
                }, errorHandler);
            }, errorHandler);
        }, errorHandler);
    }
}


function receivedAnswer(answer) {
    pc.setRemoteDescription(new sessionDescription(JSON.parse(answer)), function () {
        btn1.disabled = true;
        btn2.disabled = true
        btn3.disabled = false;
        btn3.onclick = function () {
            console.log("Ending RTCPPeer connection");
            stop();
            send("endSession", "Remote peer did hangup");
            btn3.disabled = true;
            btn2.disabled = true;
            btn1.disabled = false;
        };
    }, errorHandler);

    //the create the datachannel
    var name = "mydatachannel";
}

function send(type, message) {
    console.log('Client sending message for ' + type, message);
    if (typeof message === 'object') {
        message = JSON.stringify(message);
    }
    socket.emit(type, message);
}

var socket = io.connect(window.location.host);

socket.on('offer', function (offer) {
    offer = JSON.parse(offer);
    console.log("offer received you can answer");
    setupPeerConnection();
    btn2.disabled = false;
    btn1.disabled = true;
    btn2.onclick = function () {
        answer(offer);
        btn2.disabled = true;
        btn1.disabled = true;
        btn3.disabled = false
        btn3.onclick = function () {
            console.log("Ending RTCPPeer connection");
            stop();
            send("endSession", "Remote peer did hangup");
            btn2.disabled = true;
            btn3.disabled = true;
            btn1.disabled = false;
        };
    };
});

socket.on('answer', function (answer) {

    console.log("your call has been answered, adding remotePeer");
    receivedAnswer(answer);
});

socket.on('entry', function (msg) {
    if (clients >= 1 && clients <= 2) {
        clients = clients + 1;
        console.info(msg);
        if (clients == 2) {
            btn1.disabled = false;
            btn1.onclick = function () {
                if (pc == undefined) {
                    setupPeerConnection();
                }
                if (iceCandidates.length > 0) {
                    console.log("Calling with ICE");
                    send("iceCandidate", JSON.stringify(iceCandidates));
                    iceCandidates = [];
                    console.log("if fails try once more then we'll try just with offer/answer");
                    ;
                }
                else {
                    console.log("Calling");
                    sendOffer();
                    btn1.disabled = true;
                }
            }
            // the magic is if you received a new entry the other person also want to receive your entry so we resend it to let him know your are there
            if (msg !== 'Hi I received your online, we both can call now!') {  // don't explicity need this just for console log beauty
                send('entry', 'Hi I received your online, we both can call now!');
            }
            console.log("ready for calling");
        }// magic loop for checking if two persons on socket are there. 2/
    }//close if only 2 persons allowed
    else {
        console.error("something broken?");
    }
});

socket.on("iceCandidate", function (candidate) {
    try {
        pc.addIceCandidate(new RTCIceCandidate(JSON.parse(candidate)));
        console.log("an icecandidate added succesfully");
    } catch (err) {
        console.log("ICEerror", err);
    }
});


socket.on('endSession', function (msg) {
    stop();
    console.log("Session stopped by remote hangup you can recall", msg);
    btn1.disabled = false;
    btn2.disabled = true;
    btn3.disabled = true;
});


socket.on('log', function (array) {
    console.log("", array);
});

function addMessage(e, peer) {
    var para = document.createElement("p");
    para.class = (peer === "local" ? "bg-info" : "bg-warning");
    if (peer == "local") {
        var node = document.createTextNode(peer + " says : " + e);
        para.appendChild(node);
    }
    else {
        para.id = e.lastEventId;
        var node = document.createTextNode(peer + " says : " + e.data);
        para.appendChild(node);
    }
    var element = document.getElementById("chat");
    element.appendChild(para);
}

function sendbutton() {
    var text = document.getElementById("message").value
    sendmessage(text);
    addMessage(text, "local");
}

navigator.getUserMedia({video: true, audio: true}, function (stream) {
    if (URL === undefined) {
        throw new Error("update your browser please (URL creation not supported)");
    }
    video.src = URL.createObjectURL(stream);
}, errorHandler);

send("entry", "Hi I am online now anyone there");
