<?php
/**
 * OmeLive WebSocket Signaling Server (PHP + Ratchet)
 * Handles WebRTC Offer, Answer, ICE Candidates, Matchmaking, and Room relay.
 *
 * Requirements for PHP CLI:
 * composer require cboden/ratchet
 * Run: php signaling/server.php
 */

use Ratchet\MessageComponentInterface;
use Ratchet\ConnectionInterface;
use Ratchet\Server\IoServer;
use Ratchet\Http\HttpServer;
use Ratchet\WebSocket\WsServer;

require_once __DIR__ . '/../vendor/autoload.php';

class VideoChatSignaling implements MessageComponentInterface {
    protected \SplObjectStorage $clients;
    protected array $userSockets = []; // [userId => ConnectionInterface]
    protected array $socketUsers = []; // [connId => userId]
    protected array $activePairs = []; // [userId => peerUserId]

    public function __construct() {
        $this->clients = new \SplObjectStorage;
        echo "[Signaling] PHP WebSocket Signaling Server started.\n";
    }

    public function onOpen(ConnectionInterface $conn) {
        $this->clients->attach($conn);
        echo "[Signaling] New connection! ({$conn->resourceId})\n";
    }

    public function onMessage(ConnectionInterface $from, $msg) {
        $data = json_decode($msg, true);
        if (!$data || !isset($data['type'])) return;

        $type = $data['type'];
        $userId = $data['userId'] ?? null;

        switch ($type) {
            case 'register':
                if ($userId) {
                    $this->userSockets[$userId] = $from;
                    $this->socketUsers[$from->resourceId] = $userId;
                    $from->send(json_encode(['type' => 'registered', 'userId' => $userId]));
                    echo "[Signaling] User registered: {$userId}\n";
                }
                break;

            case 'offer':
            case 'answer':
            case 'candidate':
            case 'chat_message':
                // Relay WebRTC messages directly to target peer
                $targetUserId = $data['targetUserId'] ?? null;
                if ($targetUserId && isset($this->userSockets[$targetUserId])) {
                    $targetConn = $this->userSockets[$targetUserId];
                    $data['fromUserId'] = $userId;
                    $targetConn->send(json_encode($data));
                }
                break;

            case 'leave_match':
                $peerId = $data['peerId'] ?? null;
                if ($peerId && isset($this->userSockets[$peerId])) {
                    $this->userSockets[$peerId]->send(json_encode([
                        'type' => 'peer_left',
                        'userId' => $userId
                    ]));
                }
                break;
        }
    }

    public function onClose(ConnectionInterface $conn) {
        $this->clients->detach($conn);
        $connId = $conn->resourceId;
        if (isset($this->socketUsers[$connId])) {
            $userId = $this->socketUsers[$connId];
            unset($this->userSockets[$userId]);
            unset($this->socketUsers[$connId]);
            echo "[Signaling] User disconnected: {$userId}\n";
        }
    }

    public function onError(ConnectionInterface $conn, \Exception $e) {
        echo "[Signaling] Error: {$e->getMessage()}\n";
        $conn->close();
    }
}

$port = getenv('SIGNALING_PORT') ?: 8080;
$server = IoServer::factory(
    new HttpServer(
        new WsServer(
            new VideoChatSignaling()
        )
    ),
    $port
);

echo "WebRTC Signaling running on port {$port}\n";
$server->run();
