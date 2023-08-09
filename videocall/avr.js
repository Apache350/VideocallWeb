const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const startButton = document.getElementById('startButton');
const endButton = document.getElementById('endButton');
const shareScreenButton = document.getElementById('shareScreenButton');
const stopScreenShareButton = document.getElementById('stopScreenShareButton');
const startRecordingButton = document.getElementById('startRecordingButton');
const stopRecordingButton = document.getElementById('stopRecordingButton');

let localStream;
let remoteStream;
let peerConnection;
let screenStream;
let recordRTC;

const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
const socket = io.connect('YOUR_SIGNALLING_SERVER_URL'); // Replace with your signaling server URL

startButton.addEventListener('click', startCall);
endButton.addEventListener('click', endCall);
shareScreenButton.addEventListener('click', shareScreen);
stopScreenShareButton.addEventListener('click', stopScreenShare);
startRecordingButton.addEventListener('click', startRecording);
stopRecordingButton.addEventListener('click', stopRecording);

async function startCall() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = stream;
        localStream = stream;

        socket.emit('join', 'ROOM_ID'); // Replace with your room ID

        socket.on('user-joined', async () => {
            peerConnection = new SimplePeer({
                initiator: true,
                stream: localStream,
                config: configuration,
            });

            peerConnection.on('signal', data => {
                socket.emit('offer', JSON.stringify(data));
            });

            peerConnection.on('stream', stream => {
                remoteVideo.srcObject = stream;
                remoteStream = stream;
            });

            peerConnection.on('data', data => {
                // Handle data messages from the remote peer
            });

            socket.on('answer', answer => {
                peerConnection.signal(JSON.parse(answer));
            });
        });

        socket.on('offer', offer => {
            peerConnection = new SimplePeer({
                initiator: false,
                stream: localStream,
                config: configuration,
            });

            peerConnection.on('signal', data => {
                socket.emit('answer', JSON.stringify(data));
            });

            peerConnection.on('stream', stream => {
                remoteVideo.srcObject = stream;
                remoteStream = stream;
            });

            peerConnection.on('data', data => {
                // Handle data messages from the remote peer
            });

            peerConnection.signal(JSON.parse(offer));
        });
    } catch (error) {
        console.error('Error accessing media devices or setting up the call:', error);
    }
}

function endCall() {
    if (peerConnection) {
        peerConnection.destroy();
    }

    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }

    if (remoteStream) {
        remoteStream.getTracks().forEach(track => track.stop());
        remoteStream = null;
    }

    localVideo.srcObject = null;
    remoteVideo.srcObject = null;
}

async function shareScreen() {
    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStream = stream;

        // Replace the video track in the peer connection with the screen sharing stream
        const sender = peerConnection.getSenders().find(sender => sender.track.kind === 'video');
        if (sender) {
            sender.replaceTrack(screenStream.getTracks()[0]);
        }
    } catch (error) {
        console.error('Error accessing screen sharing:', error);
    }
}

function stopScreenShare() {
    const videoTrack = localStream.getVideoTracks()[0];
    const sender = peerConnection.getSenders().find(sender => sender.track === videoTrack);
    sender.replaceTrack(localStream.getVideoTracks()[0]);
}

function startRecording() {
    recordRTC = RecordRTC([remoteStream, screenStream], {
        type: 'video',
        mimeType: 'video/webm',
    });

    recordRTC.startRecording();
}

function stopRecording() {
    recordRTC.stopRecording(() => {
        const blob = recordRTC.getBlob();
        const url = URL.createObjectURL(blob);
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = 'recorded_video.webm';
        document.body.appendChild(downloadLink);
        downloadLink.click();
        URL.revokeObjectURL(url);
    });
}
