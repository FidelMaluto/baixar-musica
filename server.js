const express = require("express");
const cors = require("cors");
const yts = require("yt-search");
const path = require("path");
const fs = require("fs");
const os = require("os");

const { spawn } = require("child_process");

const app = express();

app.use(cors());
app.use(express.static("public"));

const PORT = process.env.PORT || 3000;

const isWindows = process.platform === "win32";

const ytDlpCommand = isWindows

    ? path.join(__dirname, "bin", "yt-dlp.exe")

    : "python3";

// PESQUISA
app.get("/api/search", async (req, res) => {

    try {

        const q = req.query.q;

        if (!q) {

            return res.json([]);

        }

        const result = await yts(q);

        const songs = result.videos
            .slice(0, 20)
            .map(v => ({

                title: v.title,
                thumbnail: v.thumbnail,
                duration: v.timestamp,
                views: v.views,
                url: v.url,
                author: v.author.name

            }));

        res.json(songs);

    } catch (err) {

        console.log(err);

        res.status(500).json({
            error: "Erro pesquisa"
        });

    }

});

// STREAM
app.get("/api/stream", async (req, res) => {
    try {
        const url = req.query.url;

        if (!url) {
            return res.status(400).send("URL inválida");
        }

        const ytDlpPath = path.join(__dirname, "bin", "yt-dlp.exe");
        const ffmpegPath = path.join(__dirname, "bin", "ffmpeg.exe");

        res.setHeader("Content-Type", "audio/mpeg");

        const ytDlp = spawn(ytDlpPath, [
            "--no-playlist",
            "-f",
            "bestaudio",
            "-o",
            "-",
            url
        ]);

        const ffmpeg = spawn(ffmpegPath, [
            "-i",
            "pipe:0",
            "-f",
            "mp3",
            "-ab",
            "192k",
            "pipe:1"
        ]);

        ytDlp.stdout.pipe(ffmpeg.stdin);
        ffmpeg.stdout.pipe(res);

        ytDlp.stderr.on("data", data => {
            console.log("yt-dlp:", data.toString());
        });

        ffmpeg.stderr.on("data", data => {
            console.log("ffmpeg:", data.toString());
        });

    } catch (err) {
        console.log(err);
        res.status(500).send("Erro stream");
    }
});

// DOWNLOAD
app.get("/api/download", async (req, res) => {
    try {

        const url = req.query.url;

        if (!url) {
            return res.status(400).send("URL inválida");
        }

        const ytDlpPath = path.join(__dirname, "bin", "yt-dlp.exe");

        const getTitulo = spawn(
            ytDlpPath,
            ["--print", "%(uploader)s - %(title)s", url]
        );

        let musicaNome = "";

        getTitulo.stdout.on("data", data => {
            musicaNome += data.toString();
        });

        getTitulo.on("close", () => {

            musicaNome = musicaNome
                .trim()
                .replace(/[\\/:*?"<>|]/g, "")
                .replace(/[^\w\s.-]/gi, "")
                .substring(0, 120);

            if (!musicaNome) {
                musicaNome = "Fleves_Music";
            }

            res.setHeader(
                "Content-Disposition",
                `attachment; filename="${musicaNome}.mp3"`
            );

            res.setHeader(
                "Content-Type",
                "audio/mpeg"
            );

            const ytDlp = spawn(
                ytDlpPath,
                [
                    "-x",
                    "--audio-format",
                    "mp3",
                    "-o",
                    "-",
                    url
                ]
            );

            ytDlp.stdout.pipe(res);

            ytDlp.stderr.on("data", data => {
                console.log(
                    "yt-dlp erro:",
                    data.toString()
                );
            });

        });

    } catch (err) {

        console.log(err);

        res.status(500).send("Erro download");

    }
});

app.listen(PORT, () => {
    console.log(`Fleves Music: http://localhost:${PORT}`);
});
