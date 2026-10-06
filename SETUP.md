# OmeLive - Production Setup & Deployment Guide

This repository contains a **fully functional random video-chat web platform** powered by:
- **WebRTC** Peer-to-Peer Audio & Video
- **WebSocket** Real-time Signaling Engine
- **PHP + MySQL** Backend Architecture & Admin Dashboard
- **React + Tailwind CSS** Modern Frontend UI

---

## 1. How to Create the MySQL Database

1. Open your MySQL command-line or phpMyAdmin tool:
   ```bash
   mysql -u root -p
   ```
2. Create the dedicated database and user:
   ```sql
   CREATE DATABASE IF NOT EXISTS omelive_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE USER IF NOT EXISTS 'omelive_user'@'localhost' IDENTIFIED BY 'YourStrongPasswordHere!';
   GRANT ALL PRIVILEGES ON omelive_db.* TO 'omelive_user'@'localhost';
   FLUSH PRIVILEGES;
   ```

---

## 2. How to Import `schema.sql`

Import the database structure located in `/database/schema.sql`:

```bash
mysql -u omelive_user -p omelive_db < database/schema.sql
```

The schema creates 5 structured tables:
1. `users` - Unique visitor IDs, detected countries, online statuses, last seen timestamps.
2. `sessions` - Secure tokens and session identifiers.
3. `matches` - Real-time matchmaking sessions and timestamps.
4. `reports` - User moderation abuse reports with reason categories.
5. `bans` - Suspended user records with expiration and moderation reason.

---

## 3. Where to Enter MySQL Credentials

Edit `/backend/config.php` or provide environment variables:

```php
define('DB_HOST', getenv('DB_HOST') ?: 'localhost');
define('DB_NAME', getenv('DB_NAME') ?: 'omelive_db');
define('DB_USER', getenv('DB_USER') ?: 'omelive_user');
define('DB_PASS', getenv('DB_PASS') ?: 'YourStrongPasswordHere!');
define('DB_PORT', getenv('DB_PORT') ?: '3306');

// Secret salt for anonymous IP hashing
define('APP_SECRET_SALT', 'your_unique_random_secret_string');

// Secret key for accessing /admin/index.php
define('ADMIN_SECRET_KEY', 'admin12345');
```

---

## 4. How to Configure PHP Backend & Web Server

### Apache Configuration
Ensure `mod_rewrite` is enabled. Set DocumentRoot to point to your public web directory with PHP 8.1+ support.

### Nginx Configuration
```nginx
server {
    listen 80;
    server_name omelive.yourdomain.com;
    root /var/www/omelive;
    index index.html index.php;

    location /api/ {
        try_files $uri $uri/ /backend/api/$uri.php;
    }

    location ~ \.php$ {
        include fastcgi_params;
        fastcgi_pass unix:/var/run/php/php8.2-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
    }
}
```

---

## 5. How to Run the Signaling Server

Real-time WebRTC pairing requires a signaling channel to exchange SDP Offer/Answer and ICE candidates.

### Option A: Node.js High-Performance WebSocket Server (Recommended)
```bash
node signaling/server.js
# Or run with PM2 in production:
pm2 start signaling/server.js --name "omelive-signaling"
```

### Option B: PHP Ratchet WebSocket Server
```bash
composer require cboden/ratchet
php signaling/server.php
```

---

## 6. How to Configure WebRTC / STUN / TURN

The application includes Google's public STUN servers by default:
- `stun:stun.l.google.com:19302`
- `stun:stun1.l.google.com:19302`

### Why TURN is Essential for Production:
While STUN works for users on open or moderate NAT networks, ~15-20% of internet connections (strict symmetric NATs, cellular carriers, corporate Wi-Fi) block direct P2P connections.
For production deployments, install **coturn** or use a cloud TURN provider (such as Twilio, Xirsys, or Cloudflare Calls):

Add your TURN server credentials to the WebRTC config:
```javascript
const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls: 'turn:turn.yourdomain.com:3478',
      username: 'webrtc_user',
      credential: 'webrtc_secure_password'
    }
  ]
};
```

---

## 7. How to Run the Website in Development

```bash
# Install dependencies
npm install

# Start the full-stack server (runs Node + Express + WebRTC WebSocket Signaling + Vite)
npm run dev

# Preview at http://localhost:3000
```

---

## 8. How to Test with Two Different Browsers / Devices

1. Open **Browser 1** (e.g. Chrome) and navigate to `http://localhost:3000`.
2. Allow camera and microphone permissions when prompted.
3. Open **Browser 2** (e.g. Chrome Incognito window, Firefox, or a second device/phone on the same local network).
4. In both windows, select your country or leave it on **"Any Country"**.
5. Click **"Start Chat"** or **"Next"** in both windows.
6. The server matchmaker pairs both clients:
   - Client A creates the WebRTC Offer.
   - Client B receives the Offer and creates the WebRTC Answer.
   - ICE candidates are exchanged over WebSocket.
   - Real peer-to-peer live video & audio streams start playing!
7. Click **"NEXT"** in either window:
   - The current WebRTC peer connection immediately closes.
   - The other user sees "Partner skipped - searching for next match...".
   - Both users are placed back into the matchmaking queue.
8. Click **"Report"** to test the moderation pipeline, then open the Admin Panel (Password: `admin12345`) to view reports and ban users.
