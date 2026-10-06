<?php
/**
 * OmeLive Video Chat - Admin Moderation Panel
 * Manage users, reports, bans, and active sessions
 */

require_once __DIR__ . '/../backend/config.php';
require_once __DIR__ . '/../backend/database.php';

session_start();

$message = '';
$error = '';

// Simple secure admin authentication
if (isset($_POST['login'])) {
    $adminKey = $_POST['admin_key'] ?? '';
    if ($adminKey === ADMIN_SECRET_KEY) {
        $_SESSION['admin_authenticated'] = true;
    } else {
        $error = 'Invalid administrative secret key.';
    }
}

if (isset($_GET['logout'])) {
    unset($_SESSION['admin_authenticated']);
    session_destroy();
    header("Location: index.php");
    exit;
}

$isAuthenticated = !empty($_SESSION['admin_authenticated']);

if ($isAuthenticated) {
    $db = Database::getConnection();

    // Handle Ban Action
    if (isset($_POST['action']) && $_POST['action'] === 'ban') {
        $banUserId = trim($_POST['user_id'] ?? '');
        $banReason = trim($_POST['reason'] ?? 'Violation of Terms of Service');
        $hours = (int)($_POST['hours'] ?? 24);

        if ($banUserId) {
            $banId = 'ban_' . bin2hex(random_bytes(8));
            $expiresAt = $hours > 0 ? date('Y-m-d H:i:s', time() + ($hours * 3600)) : null;

            $stmt = $db->prepare("
                INSERT INTO bans (ban_id, unique_user_id, reason, banned_by, is_active, created_at, expires_at)
                VALUES (:bid, :uid, :reason, 'admin_panel', 1, NOW(), :exp)
                ON DUPLICATE KEY UPDATE reason = :reason, is_active = 1, expires_at = :exp
            ");
            $stmt->execute([
                ':bid' => $banId,
                ':uid' => $banUserId,
                ':reason' => $banReason,
                ':exp' => $expiresAt
            ]);
            $message = "User $banUserId has been banned.";
        }
    }

    // Handle Unban Action
    if (isset($_POST['action']) && $_POST['action'] === 'unban') {
        $unbanUserId = trim($_POST['user_id'] ?? '');
        if ($unbanUserId) {
            $stmt = $db->prepare("UPDATE bans SET is_active = 0 WHERE unique_user_id = :uid");
            $stmt->execute([':uid' => $unbanUserId]);
            $message = "User $unbanUserId unbanned successfully.";
        }
    }

    // Handle Resolve Report
    if (isset($_POST['action']) && $_POST['action'] === 'resolve_report') {
        $reportId = trim($_POST['report_id'] ?? '');
        if ($reportId) {
            $stmt = $db->prepare("UPDATE reports SET status = 'resolved' WHERE report_id = :rid");
            $stmt->execute([':rid' => $reportId]);
            $message = "Report $reportId marked as resolved.";
        }
    }

    // Statistics
    $totalUsers = $db->query("SELECT COUNT(*) FROM users")->fetchColumn();
    $onlineUsers = $db->query("SELECT COUNT(*) FROM users WHERE online_status != 'offline' AND last_seen >= NOW() - INTERVAL 30 SECOND")->fetchColumn();
    $activeMatches = $db->query("SELECT COUNT(*) FROM matches WHERE status IN ('connecting', 'active')")->fetchColumn();
    $totalReports = $db->query("SELECT COUNT(*) FROM reports")->fetchColumn();
    $pendingReports = $db->query("SELECT COUNT(*) FROM reports WHERE status = 'pending'")->fetchColumn();
    $totalBans = $db->query("SELECT COUNT(*) FROM bans WHERE is_active = 1")->fetchColumn();

    // Recent reports
    $stmtReports = $db->query("
        SELECT r.*, u.country as reported_country 
        FROM reports r 
        LEFT JOIN users u ON r.reported_user_id = u.unique_user_id 
        ORDER BY r.created_at DESC 
        LIMIT 25
    ");
    $reports = $stmtReports->fetchAll();

    // Recent users
    $stmtUsers = $db->query("
        SELECT * FROM users 
        ORDER BY last_seen DESC 
        LIMIT 30
    ");
    $users = $stmtUsers->fetchAll();

    // Active Bans
    $stmtBans = $db->query("
        SELECT * FROM bans 
        WHERE is_active = 1 
        ORDER BY created_at DESC 
        LIMIT 25
    ");
    $bans = $stmtBans->fetchAll();

    // Active Matches
    $stmtActiveMatches = $db->query("
        SELECT * FROM matches 
        WHERE status IN ('connecting', 'active') 
        ORDER BY created_at DESC 
        LIMIT 20
    ");
    $matches = $stmtActiveMatches->fetchAll();
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OmeLive Moderation Admin Panel</title>
    <style>
        :root {
            --bg: #0f172a;
            --card: #1e293b;
            --card-border: #334155;
            --primary: #3b82f6;
            --danger: #ef4444;
            --warning: #f59e0b;
            --success: #10b981;
            --text: #f8fafc;
            --text-muted: #94a3b8;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        body { background: var(--bg); color: var(--text); padding: 24px; min-height: 100vh; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; border-bottom: 1px solid var(--card-border); padding-bottom: 16px; }
        .badge { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
        .badge-danger { background: rgba(239, 68, 68, 0.2); color: #f87171; }
        .badge-success { background: rgba(16, 185, 129, 0.2); color: #34d399; }
        .badge-warning { background: rgba(245, 158, 11, 0.2); color: #fbbf24; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 24px; }
        .stat-card { background: var(--card); border: 1px solid var(--card-border); padding: 16px; border-radius: 8px; }
        .stat-val { font-size: 28px; font-weight: bold; margin-top: 4px; }
        .section { background: var(--card); border: 1px solid var(--card-border); border-radius: 8px; padding: 20px; margin-bottom: 24px; }
        .section-title { font-size: 18px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; }
        table { width: 100%; border-collapse: collapse; text-align: left; font-size: 14px; }
        th, td { padding: 10px 12px; border-bottom: 1px solid var(--card-border); }
        th { color: var(--text-muted); font-weight: 600; text-transform: uppercase; font-size: 11px; }
        tr:hover { background: rgba(255,255,255,0.02); }
        .btn { padding: 6px 12px; border-radius: 4px; font-weight: 500; cursor: pointer; border: none; font-size: 12px; }
        .btn-danger { background: var(--danger); color: white; }
        .btn-success { background: var(--success); color: white; }
        .btn-primary { background: var(--primary); color: white; }
        .login-box { max-width: 400px; margin: 100px auto; background: var(--card); border: 1px solid var(--card-border); padding: 32px; border-radius: 8px; }
        .form-group { margin-bottom: 16px; }
        .form-group label { display: block; margin-bottom: 6px; font-size: 14px; color: var(--text-muted); }
        .form-control { width: 100%; padding: 10px; background: #0b1120; border: 1px solid var(--card-border); color: var(--text); border-radius: 6px; }
    </style>
</head>
<body>
<div class="container">
    <?php if (!$isAuthenticated): ?>
        <div class="login-box">
            <h2 style="margin-bottom: 16px;">OmeLive Admin Access</h2>
            <?php if ($error): ?><p style="color: var(--danger); margin-bottom: 12px;"><?= htmlspecialchars($error) ?></p><?php endif; ?>
            <form method="POST">
                <div class="form-group">
                    <label>Admin Secret Key</label>
                    <input type="password" name="admin_key" class="form-control" placeholder="Enter ADMIN_SECRET_KEY..." required autofocus>
                </div>
                <button type="submit" name="login" class="btn btn-primary" style="width: 100%; padding: 10px;">Enter Dashboard</button>
            </form>
        </div>
    <?php else: ?>
        <div class="header">
            <div>
                <h2>OmeLive Moderation Dashboard</h2>
                <p style="color: var(--text-muted); font-size: 13px;">Real-Time Moderation, User Verification & Reporting</p>
            </div>
            <div>
                <a href="?logout=1" class="btn btn-danger" style="text-decoration: none;">Log Out</a>
            </div>
        </div>

        <?php if ($message): ?><div style="background: rgba(16,185,129,0.2); color: #34d399; padding: 12px; border-radius: 6px; margin-bottom: 16px;"><?= htmlspecialchars($message) ?></div><?php endif; ?>

        <!-- Stats Grid -->
        <div class="stats-grid">
            <div class="stat-card">
                <span style="color: var(--text-muted); font-size: 12px;">ONLINE USERS</span>
                <div class="stat-val" style="color: var(--success);"><?= number_format($onlineUsers) ?></div>
            </div>
            <div class="stat-card">
                <span style="color: var(--text-muted); font-size: 12px;">ACTIVE SESSIONS</span>
                <div class="stat-val" style="color: var(--primary);"><?= number_format($activeMatches) ?></div>
            </div>
            <div class="stat-card">
                <span style="color: var(--text-muted); font-size: 12px;">PENDING REPORTS</span>
                <div class="stat-val" style="color: var(--danger);"><?= number_format($pendingReports) ?></div>
            </div>
            <div class="stat-card">
                <span style="color: var(--text-muted); font-size: 12px;">TOTAL REGISTERED</span>
                <div class="stat-val"><?= number_format($totalUsers) ?></div>
            </div>
            <div class="stat-card">
                <span style="color: var(--text-muted); font-size: 12px;">ACTIVE BANS</span>
                <div class="stat-val" style="color: var(--warning);"><?= number_format($totalBans) ?></div>
            </div>
        </div>

        <!-- Reports Section -->
        <div class="section">
            <div class="section-title">
                <span>Recent User Reports (<?= count($reports) ?>)</span>
            </div>
            <?php if (empty($reports)): ?>
                <p style="color: var(--text-muted); font-size: 14px;">No reports registered.</p>
            <?php else: ?>
                <table>
                    <thead>
                        <tr>
                            <th>Report ID</th>
                            <th>Reported User</th>
                            <th>Reason</th>
                            <th>Details</th>
                            <th>Status</th>
                            <th>Timestamp</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($reports as $r): ?>
                            <tr>
                                <td><code><?= htmlspecialchars($r['report_id']) ?></code></td>
                                <td>
                                    <strong><?= htmlspecialchars($r['reported_user_id']) ?></strong><br>
                                    <small style="color: var(--text-muted);"><?= htmlspecialchars($r['reported_country'] ?? 'Unknown') ?></small>
                                </td>
                                <td><span class="badge badge-danger"><?= htmlspecialchars($r['reason']) ?></span></td>
                                <td style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                    <?= htmlspecialchars($r['details'] ?: '-') ?>
                                </td>
                                <td>
                                    <span class="badge <?= $r['status'] === 'pending' ? 'badge-warning' : 'badge-success' ?>">
                                        <?= strtoupper($r['status']) ?>
                                    </span>
                                </td>
                                <td><?= htmlspecialchars($r['created_at']) ?></td>
                                <td>
                                    <form method="POST" style="display:inline-block; margin-right: 4px;">
                                        <input type="hidden" name="action" value="ban">
                                        <input type="hidden" name="user_id" value="<?= htmlspecialchars($r['reported_user_id']) ?>">
                                        <input type="hidden" name="reason" value="<?= htmlspecialchars($r['reason']) ?>">
                                        <input type="hidden" name="hours" value="72">
                                        <button type="submit" class="btn btn-danger" onclick="return confirm('Ban this user for 72h?');">Ban User</button>
                                    </form>
                                    <?php if ($r['status'] === 'pending'): ?>
                                    <form method="POST" style="display:inline-block;">
                                        <input type="hidden" name="action" value="resolve_report">
                                        <input type="hidden" name="report_id" value="<?= htmlspecialchars($r['report_id']) ?>">
                                        <button type="submit" class="btn btn-success">Resolve</button>
                                    </form>
                                    <?php endif; ?>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            <?php endif; ?>
        </div>

        <!-- Active Matches Section -->
        <div class="section">
            <div class="section-title">
                <span>Active Video Chat Matches (<?= count($matches) ?>)</span>
            </div>
            <?php if (empty($matches)): ?>
                <p style="color: var(--text-muted); font-size: 14px;">No active peer-to-peer matches right now.</p>
            <?php else: ?>
                <table>
                    <thead>
                        <tr>
                            <th>Match ID</th>
                            <th>Participant A</th>
                            <th>Participant B</th>
                            <th>Status</th>
                            <th>Started</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($matches as $m): ?>
                            <tr>
                                <td><code><?= htmlspecialchars($m['match_id']) ?></code></td>
                                <td><?= htmlspecialchars($m['user_a_id']) ?> (<?= htmlspecialchars($m['user_a_country']) ?>)</td>
                                <td><?= htmlspecialchars($m['user_b_id']) ?> (<?= htmlspecialchars($m['user_b_country']) ?>)</td>
                                <td><span class="badge badge-success"><?= strtoupper($m['status']) ?></span></td>
                                <td><?= htmlspecialchars($m['created_at']) ?></td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            <?php endif; ?>
        </div>

        <!-- Users Directory -->
        <div class="section">
            <div class="section-title">
                <span>Recent Platform Visitors (<?= count($users) ?>)</span>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Unique User ID</th>
                        <th>Country</th>
                        <th>Status</th>
                        <th>First Seen</th>
                        <th>Last Seen</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($users as $u): ?>
                        <tr>
                            <td><code><?= htmlspecialchars($u['unique_user_id']) ?></code></td>
                            <td><?= htmlspecialchars($u['country']) ?> (<?= htmlspecialchars($u['country_code']) ?>)</td>
                            <td>
                                <span class="badge <?= $u['online_status'] === 'matched' ? 'badge-primary' : ($u['online_status'] === 'waiting' ? 'badge-warning' : 'badge-danger') ?>">
                                    <?= strtoupper($u['online_status']) ?>
                                </span>
                            </td>
                            <td><?= htmlspecialchars($u['created_at']) ?></td>
                            <td><?= htmlspecialchars($u['last_seen']) ?></td>
                            <td>
                                <form method="POST" style="display:inline-block;">
                                    <input type="hidden" name="action" value="ban">
                                    <input type="hidden" name="user_id" value="<?= htmlspecialchars($u['unique_user_id']) ?>">
                                    <input type="hidden" name="reason" value="Violation of platform guidelines">
                                    <input type="hidden" name="hours" value="24">
                                    <button type="submit" class="btn btn-danger" onclick="return confirm('Ban user <?= htmlspecialchars($u['unique_user_id']) ?>?');">Ban</button>
                                </form>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>

        <!-- Active Bans Section -->
        <div class="section">
            <div class="section-title">
                <span>Active User Suspensions (<?= count($bans) ?>)</span>
            </div>
            <?php if (empty($bans)): ?>
                <p style="color: var(--text-muted); font-size: 14px;">No active bans.</p>
            <?php else: ?>
                <table>
                    <thead>
                        <tr>
                            <th>Ban ID</th>
                            <th>User ID</th>
                            <th>Reason</th>
                            <th>Banned At</th>
                            <th>Expires</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($bans as $b): ?>
                            <tr>
                                <td><code><?= htmlspecialchars($b['ban_id']) ?></code></td>
                                <td><?= htmlspecialchars($b['unique_user_id']) ?></td>
                                <td><?= htmlspecialchars($b['reason']) ?></td>
                                <td><?= htmlspecialchars($b['created_at']) ?></td>
                                <td><?= htmlspecialchars($b['expires_at'] ?: 'Permanent') ?></td>
                                <td>
                                    <form method="POST" style="display:inline-block;">
                                        <input type="hidden" name="action" value="unban">
                                        <input type="hidden" name="user_id" value="<?= htmlspecialchars($b['unique_user_id']) ?>">
                                        <button type="submit" class="btn btn-success">Unban</button>
                                    </form>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            <?php endif; ?>
        </div>
    <?php endif; ?>
</div>
</body>
</html>
