import OBSWebSocket from "obs-websocket-js";

export class ObsManager {
  private obs: OBSWebSocket;
  private isConnected: boolean = false;
  private address: string = "ws://localhost:4455";
  private password?: string;

  constructor() {
    this.obs = new OBSWebSocket();
    this.obs.on("ConnectionClosed", () => {
      this.isConnected = false;
      console.log("⚠️ OBS Connection Closed");
    });
  }

  async connect(address: string = "ws://localhost:4455", password?: string) {
    if (this.isConnected) return true;

    try {
      this.address = address;
      this.password = password;
      const { obsWebSocketVersion, negotiatedRpcVersion } =
        await this.obs.connect(address, password);
      this.isConnected = true;
      console.log(`✅ Connected to OBS (Version ${obsWebSocketVersion})`);
      return true;
    } catch (error) {
      console.error("❌ Failed to connect to OBS:", error);
      this.isConnected = false;
      return false;
    }
  }

  async disconnect() {
    await this.obs.disconnect();
    this.isConnected = false;
  }

  async switchScene(sceneName: string) {
    if (!this.isConnected) return false;

    try {
      await this.obs.call("SetCurrentProgramScene", { sceneName });
      console.log(`🎬 Switched to scene: ${sceneName}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to switch to scene ${sceneName}:`, error);
      return false;
    }
  }

  async getScenes() {
    if (!this.isConnected) return [];
    try {
      const response = await this.obs.call("GetSceneList");
      return response.scenes.map((s: any) => s.sceneName) as string[];
    } catch (error) {
      console.error("Failed to get scenes", error);
      return [];
    }
  }

  getStatus() {
    return { connected: this.isConnected, address: this.address };
  }

  async applyLayout(layout: any) {
    if (!this.isConnected) return false;

    try {
      const collectionName = layout.name || "Imported Layout";
      console.log(`📦 Applying layout: ${collectionName}`);

      // 1. Try to create/switch to collection
      try {
        // Try creating (switches automatically if successful)
        await this.obs.call("CreateSceneCollection", {
          sceneCollectionName: collectionName,
        });
        console.log(`✅ Created collection: ${collectionName}`);
      } catch (e) {
        // If exists, switch to it
        try {
          await this.obs.call("SetCurrentSceneCollection", {
            sceneCollectionName: collectionName,
          });
          console.log(`🔄 Switched to collection: ${collectionName}`);
        } catch (switchErr) {
          console.warn("⚠️ Could not switch/create collection, using current.");
        }
      }

      // 2. Create Scenes
      if (layout.scene_order && Array.isArray(layout.scene_order)) {
        for (const scene of layout.scene_order) {
          try {
            await this.obs.call("CreateScene", { sceneName: scene.name });
            console.log(`+ Created scene: ${scene.name}`);
          } catch (err) {
            // Ignore if already exists
            // console.log(`(Scene ${scene.name} exists)`);
          }
        }
      }

      // 3. Switch to starting scene
      if (layout.current_program_scene) {
        await this.switchScene(layout.current_program_scene);
      }

      return true;
    } catch (error) {
      console.error("❌ applyLayout failed:", error);
      return false;
    }
  }
}

export const obsManager = new ObsManager();
