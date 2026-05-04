import { constants } from "node:fs";
import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { env } from "../../config/env.js";

const require = createRequire(import.meta.url);
const ffmpegStatic = require("ffmpeg-static") as string | null;

export type VideoScene = {
  title: string;
  body: string;
};

export type WeeklyVideoInput = {
  title: string;
  scenes: VideoScene[];
  cta: string;
  symbol: string;
  musicPath?: string;
  voiceoverPath?: string;
  musicVolume?: number;
  voiceoverVolume?: number;
};

type RenderCommand = {
  file: string;
  args: string[];
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function ffmpegEscape(text: string) {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'")
    .replace(/\[/g, "\\[")
    .replace(/]/g, "\\]")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function quoteShell(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export class VideoRenderService {
  private async resolveReadablePath(...candidates: Array<string | undefined>) {
    for (const candidate of candidates) {
      if (!candidate) {
        continue;
      }

      const resolved = path.isAbsolute(candidate) ? candidate : path.resolve(process.cwd(), candidate);

      try {
        await access(resolved, constants.R_OK);
        return resolved;
      } catch {
        // try next candidate
      }
    }

    return undefined;
  }

  private async resolveFontPath() {
    return (
      (await this.resolveReadablePath(
        env.VIDEO_FONT_PATH,
        "./assets/fonts/Inter-Regular.ttf",
        "./assets/fonts/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/Library/Fonts/Arial.ttf"
      )) ?? "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    );
  }

  private resolveMediaPath(candidate?: string) {
    if (!candidate) {
      return undefined;
    }

    return path.isAbsolute(candidate) ? candidate : path.resolve(process.cwd(), candidate);
  }

  private getFfmpegPath() {
    return env.FFMPEG_PATH || ffmpegStatic || "ffmpeg";
  }

  private async hasFfmpeg() {
    return new Promise<boolean>((resolve) => {
      const child = spawn(this.getFfmpegPath(), ["-version"]);
      child.on("error", () => resolve(false));
      child.on("exit", (code: number | null) => resolve(code === 0));
    });
  }

  private async run(command: RenderCommand) {
    return new Promise<void>((resolve, reject) => {
      const child = spawn(this.getFfmpegPath(), command.args, { stdio: "ignore" });
      child.on("error", reject);
      child.on("exit", (code: number | null) => {
        if (code === 0) {
          resolve();
          return;
        }

        reject(new Error(`FFmpeg failed for ${command.file} with exit code ${code}`));
      });
    });
  }

  private buildSceneCommand(scene: VideoScene, outputFile: string, fontPath: string) {
    const title = ffmpegEscape(scene.title);
    const body = ffmpegEscape(scene.body);
    const drawBox = `drawbox=x=60:y=120:w=${env.VIDEO_WIDTH - 120}:h=${env.VIDEO_HEIGHT - 240}:color=#142231@0.94:t=fill`;
    const titleText = `drawtext=fontfile='${ffmpegEscape(fontPath)}':text='${title}':fontcolor=white:fontsize=64:x=80:y=180`;
    const bodyText = `drawtext=fontfile='${ffmpegEscape(fontPath)}':text='${body}':fontcolor=white:fontsize=42:line_spacing=12:x=80:y=360`;
    const filter = [drawBox, titleText, bodyText].join(",");

    return {
      file: outputFile,
      args: [
        "-y",
        "-f",
        "lavfi",
        "-i",
        `color=c=#0b1220:s=${env.VIDEO_WIDTH}x${env.VIDEO_HEIGHT}:d=${env.VIDEO_SCENE_DURATION_SEC}`,
        "-vf",
        filter,
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        outputFile
      ]
    };
  }

  private buildConcatCommand(concatFile: string, outputFile: string): RenderCommand {
    return {
      file: outputFile,
      args: ["-y", "-f", "concat", "-safe", "0", "-i", concatFile, "-c", "copy", outputFile]
    };
  }

  private buildAudioMuxCommand(
    inputVideoFile: string,
    outputFile: string,
    options: {
      musicPath?: string;
      voiceoverPath?: string;
      musicVolume: number;
      voiceoverVolume: number;
    }
  ): RenderCommand | null {
    const { musicPath, voiceoverPath, musicVolume, voiceoverVolume } = options;

    if (!musicPath && !voiceoverPath) {
      return null;
    }

    if (voiceoverPath && musicPath) {
      return {
        file: outputFile,
        args: [
          "-y",
          "-i",
          inputVideoFile,
          "-i",
          voiceoverPath,
          "-i",
          musicPath,
          "-filter_complex",
          `[1:a]volume=${voiceoverVolume}[voice];[2:a]volume=${musicVolume}[music];[voice][music]amix=inputs=2:duration=longest[aout]`,
          "-map",
          "0:v:0",
          "-map",
          "[aout]",
          "-c:v",
          "copy",
          "-c:a",
          "aac",
          "-shortest",
          outputFile
        ]
      };
    }

    if (voiceoverPath) {
      return {
        file: outputFile,
        args: [
          "-y",
          "-i",
          inputVideoFile,
          "-i",
          voiceoverPath,
          "-filter:a",
          `volume=${voiceoverVolume}`,
          "-map",
          "0:v:0",
          "-map",
          "1:a:0",
          "-c:v",
          "copy",
          "-c:a",
          "aac",
          "-shortest",
          outputFile
        ]
      };
    }

    return {
      file: outputFile,
      args: [
        "-y",
        "-i",
        inputVideoFile,
        "-i",
        musicPath!,
        "-filter:a",
        `volume=${musicVolume}`,
        "-map",
        "0:v:0",
        "-map",
        "1:a:0",
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-shortest",
        outputFile
      ]
    };
  }

  buildDefaultInput(symbol: string): WeeklyVideoInput {
    return {
      title: `ATMA Weekly Summary — ${symbol}`,
      symbol,
      cta: "Follow the system for the next weekly report.",
      musicPath: env.VIDEO_DEFAULT_MUSIC_PATH,
      voiceoverPath: env.VIDEO_DEFAULT_VOICEOVER_PATH,
      musicVolume: env.VIDEO_MUSIC_VOLUME,
      voiceoverVolume: env.VIDEO_VOICEOVER_VOLUME,
      scenes: [
        {
          title: "What the model did",
          body: `This week ATMA reviewed ${symbol}, kept risk checks active, and stayed focused on low-frequency execution.`
        },
        {
          title: "Risk before hype",
          body: "The system prioritizes drawdown control, daily loss limits, and boring repeatability over prediction content."
        },
        {
          title: "What comes next",
          body: "Next step: publish more transparently, track traction, and improve the media engine without breaking treasury discipline."
        }
      ]
    };
  }

  async renderWeeklySummary(input: WeeklyVideoInput) {
    const slug = slugify(input.title || `atma-${input.symbol}`);
    const renderId = `${slug}-${Date.now()}`;
    const outputDir = path.resolve(process.cwd(), env.MEDIA_OUTPUT_DIR, renderId);
    const fontPath = await this.resolveFontPath();
    const musicPath = this.resolveMediaPath(input.musicPath);
    const voiceoverPath = this.resolveMediaPath(input.voiceoverPath);
    await mkdir(outputDir, { recursive: true });

    const manifest = {
      renderId,
      createdAt: new Date().toISOString(),
      input,
      settings: {
        ffmpegPath: this.getFfmpegPath(),
        width: env.VIDEO_WIDTH,
        height: env.VIDEO_HEIGHT,
        sceneDurationSec: env.VIDEO_SCENE_DURATION_SEC,
        fontPath
      }
    };

    const sceneFiles = input.scenes.map((_, index) => path.join(outputDir, `scene-${String(index + 1).padStart(2, "0")}.mp4`));
    const concatFile = path.join(outputDir, "concat.txt");
    const outputFile = path.join(outputDir, "weekly-summary.mp4");
    const baseOutputFile = path.join(outputDir, "weekly-summary-base.mp4");
    const manifestFile = path.join(outputDir, "manifest.json");
    const shellFile = path.join(outputDir, "render.sh");

    const commands = input.scenes.map((scene, index) => this.buildSceneCommand(scene, sceneFiles[index], fontPath));
    const concatCommand = this.buildConcatCommand(concatFile, musicPath || voiceoverPath ? baseOutputFile : outputFile);
    const audioMuxCommand = this.buildAudioMuxCommand(concatCommand.file, outputFile, {
      musicPath,
      voiceoverPath,
      musicVolume: input.musicVolume ?? env.VIDEO_MUSIC_VOLUME,
      voiceoverVolume: input.voiceoverVolume ?? env.VIDEO_VOICEOVER_VOLUME
    });

    await writeFile(manifestFile, JSON.stringify(manifest, null, 2), "utf8");
    await writeFile(
      concatFile,
      sceneFiles.map((file) => `file ${quoteShell(file)}`).join("\n"),
      "utf8"
    );
    await writeFile(
      shellFile,
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        ...commands.map((command) => `${quoteShell(this.getFfmpegPath())} ${command.args.map(quoteShell).join(" ")}`),
        `${quoteShell(this.getFfmpegPath())} ${concatCommand.args.map(quoteShell).join(" ")}`,
        ...(audioMuxCommand
          ? [`${quoteShell(this.getFfmpegPath())} ${audioMuxCommand.args.map(quoteShell).join(" ")}`]
          : [])
      ].join("\n"),
      "utf8"
    );

    const ffmpegReady = await this.hasFfmpeg();

    if (!ffmpegReady) {
      return {
        ok: true,
        status: "planned",
        message: "FFmpeg is not installed. Render bundle created for later execution.",
        renderId,
        outputDir,
        manifestFile,
        shellFile,
        outputFile
      };
    }

    for (const command of commands) {
      await this.run(command);
    }

    await this.run(concatCommand);

    if (audioMuxCommand) {
      await this.run(audioMuxCommand);
    }

    return {
      ok: true,
      status: "rendered",
      renderId,
      outputDir,
      manifestFile,
      shellFile,
      outputFile
    };
  }
}
