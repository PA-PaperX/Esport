const { app, BrowserWindow, shell } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

let mainWindow;
let serverProcess;
const PORT = 3000;

// Find bun executable
function getBunPath() {
    // Try common locations
    const paths = [
        path.join(process.env.HOME || '', '.bun', 'bin', 'bun'),
        '/usr/local/bin/bun',
        'bun'
    ];

    for (const p of paths) {
        try {
            require('child_process').execSync(`${p} --version`, { stdio: 'ignore' });
            return p;
        } catch (e) {
            continue;
        }
    }
    return 'bun'; // fallback
}

// Start the Bun server
function startServer() {
    const bunPath = getBunPath();
    const serverPath = path.join(__dirname, 'index.ts');

    console.log('🚀 Starting Bun server...');

    serverProcess = spawn(bunPath, ['run', serverPath], {
        cwd: __dirname,
        stdio: ['ignore', 'pipe', 'pipe']
    });

    serverProcess.stdout.on('data', (data) => {
        console.log(`[Server] ${data}`);
    });

    serverProcess.stderr.on('data', (data) => {
        console.error(`[Server Error] ${data}`);
    });

    serverProcess.on('close', (code) => {
        console.log(`Server process exited with code ${code}`);
    });
}

// Stop the server
function stopServer() {
    if (serverProcess) {
        serverProcess.kill('SIGTERM');
        serverProcess = null;
    }
}

// Create main window
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1200,
        minHeight: 700,
        title: 'Esport Control Panel',
        icon: path.join(__dirname, 'public', 'icon.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        },
        autoHideMenuBar: true,
        backgroundColor: '#111827'
    });

    // Wait for server to start then load
    setTimeout(() => {
        mainWindow.loadURL(`http://localhost:${PORT}`);
    }, 1500);

    // Open overlay links in external browser
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.includes('/overlay')) {
            shell.openExternal(url);
            return { action: 'deny' };
        }
        return { action: 'allow' };
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// App ready
app.whenReady().then(() => {
    startServer();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// Quit when all windows closed (except on macOS)
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Cleanup on quit
app.on('before-quit', () => {
    stopServer();
});

app.on('will-quit', () => {
    stopServer();
});

console.log('🎮 Esport Control Panel - Electron App');
