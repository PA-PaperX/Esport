const { app, BrowserWindow, shell } = require("electron");
const { spawn } = require("child_process");
const path = require("path");

let mainWindow;
let serverProcess;
const PORT = 3000;

// Find bun executable (Cross-platform: Windows + Linux/macOS)
function getBunPath() {
  const isWindows = process.platform === "win32";

  // Build paths based on platform
  const paths = [];

  if (isWindows) {
    // Windows paths
    const userProfile = process.env.USERPROFILE || process.env.HOME || "";
    paths.push(
      path.join(userProfile, ".bun", "bin", "bun.exe"),
      path.join(process.env.LOCALAPPDATA || "", "bun", "bun.exe"),
      path.join(process.env.ProgramFiles || "", "bun", "bun.exe"),
      "bun.exe",
      "bun",
    );
  } else {
    // Linux/macOS paths
    paths.push(
      path.join(process.env.HOME || "", ".bun", "bin", "bun"),
      "/usr/local/bin/bun",
      "/opt/homebrew/bin/bun",
      "bun",
    );
  }

  for (const p of paths) {
    try {
      require("child_process").execSync(`"${p}" --version`, {
        stdio: "ignore",
      });
      return p;
    } catch (e) {
      continue;
    }
  }
  return isWindows ? "bun.exe" : "bun"; // fallback
}

// Start the Bun server
function startServer() {
  const bunPath = getBunPath();
  const serverPath = path.join(__dirname, "index.ts");

  console.log("🚀 Starting Bun server...");

  serverProcess = spawn(bunPath, ["run", serverPath], {
    cwd: __dirname,
    stdio: ["ignore", "pipe", "pipe"],
  });

  serverProcess.stdout.on("data", (data) => {
    console.log(`[Server] ${data}`);
  });

  serverProcess.stderr.on("data", (data) => {
    console.error(`[Server Error] ${data}`);
  });

  serverProcess.on("close", (code) => {
    console.log(`Server process exited with code ${code}`);
  });
}

// Stop the server (Cross-platform)
function stopServer() {
  if (serverProcess) {
    if (process.platform === "win32") {
      // Windows: use taskkill to terminate the process tree
      try {
        require("child_process").execSync(
          `taskkill /pid ${serverProcess.pid} /T /F`,
          { stdio: "ignore" },
        );
      } catch (e) {
        // Process may have already exited
      }
    } else {
      // Unix: use SIGTERM
      serverProcess.kill("SIGTERM");
    }
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
    title: "Esport Control Panel",
    frame: true,
    icon: path.join(__dirname, "public", "icon.png"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    autoHideMenuBar: true,
  });

  // Wait for server to start then load
  setTimeout(() => {
    mainWindow.loadURL(`http://localhost:${PORT}`);
  }, 1500);

  // Open overlay links in external browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.includes("/overlay")) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// App ready
app.whenReady().then(() => {
  startServer();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows closed (except on macOS)
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// Cleanup on quit
app.on("before-quit", () => {
  stopServer();
});

app.on("will-quit", () => {
  stopServer();
});

console.log("🎮 Esport Control Panel - Electron App");
