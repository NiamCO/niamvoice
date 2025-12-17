// SUPER SIMPLE Signaling Server for WebRTC
const WebSocket = require('ws');

const server = new WebSocket.Server({ port: process.env.PORT || 8080 });
const rooms = new Map();

console.log('✅ Signaling server running on port', process.env.PORT || 8080);

server.on('connection', (socket) => {
    console.log('🔗 New connection');
    
    socket.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log('📨 Message:', data.type);
            
            if (data.type === 'join') {
                // Join a room
                const { roomId, peerId } = data;
                
                if (!rooms.has(roomId)) {
                    rooms.set(roomId, new Map());
                }
                
                rooms.get(roomId).set(peerId, socket);
                console.log(`👤 ${peerId} joined room ${roomId}`);
                
                // Send list of other peers in room
                const otherPeers = Array.from(rooms.get(roomId).keys())
                    .filter(id => id !== peerId);
                
                socket.send(JSON.stringify({
                    type: 'peers',
                    peers: otherPeers
                }));
                
                // Tell others about new peer
                broadcastToRoom(roomId, peerId, {
                    type: 'new-peer',
                    peerId
                });
            }
            
            if (data.type === 'signal') {
                // Forward WebRTC signal to specific peer
                const { to, signal } = data;
                const targetSocket = findPeerSocket(data.roomId, to);
                
                if (targetSocket) {
                    targetSocket.send(JSON.stringify({
                        type: 'signal',
                        from: data.from,
                        signal
                    }));
                }
            }
            
            if (data.type === 'mute' || data.type === 'speaking') {
                // Broadcast mute/speaking status
                broadcastToRoom(data.roomId, data.peerId, {
                    type: data.type,
                    peerId: data.peerId,
                    value: data.value
                });
            }
            
        } catch (error) {
            console.error('❌ Error:', error);
        }
    });
    
    socket.on('close', () => {
        console.log('❌ Connection closed');
        // Clean up disconnected peers
        for (const [roomId, peers] of rooms) {
            for (const [peerId, peerSocket] of peers) {
                if (peerSocket === socket) {
                    peers.delete(peerId);
                    broadcastToRoom(roomId, peerId, {
                        type: 'peer-left',
                        peerId
                    });
                    
                    if (peers.size === 0) {
                        rooms.delete(roomId);
                    }
                    break;
                }
            }
        }
    });
});

function broadcastToRoom(roomId, excludePeerId, message) {
    const room = rooms.get(roomId);
    if (!room) return;
    
    for (const [peerId, socket] of room) {
        if (peerId !== excludePeerId && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(message));
        }
    }
}

function findPeerSocket(roomId, peerId) {
    const room = rooms.get(roomId);
    return room ? room.get(peerId) : null;
}

// Clean empty rooms every hour
setInterval(() => {
    for (const [roomId, peers] of rooms) {
        if (peers.size === 0) {
            rooms.delete(roomId);
        }
    }
}, 3600000);
