const express = require("express");
const cors = require("cors");
const yts = require("yt-search");
const path = require("path");

process.env.FFMPEG_PATH = path.join(__dirname, "bin", "ffmpeg.exe");
process.env.FFPROBE_PATH = path.join(__dirname, "bin", "ffprobe.exe");

const { spawn } = require("child_process");
const { get } = require("http");

const app = express();

app.use(cors());
app.use(express.static("./public"));

const PORT = 3000;

// PESQUISAR MÚSICAS
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
                duration: v.timestamp,
                views: v.views,
                thumbnail: v.thumbnail,
                url: v.url,
                author: v.author.name
            }));

        res.json(songs);

    } catch (err) {
        console.log(err);

        res.status(500).json({
            error: "Erro na pesquisa"
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

        // HEADERS
        res.setHeader("Content-Type", "audio/mpeg");

        // yt-dlp
        const ytDlp = spawn(ytDlpPath,
            ["--js-runtimes", "node", "--no-playlist", "-f", "ba", "-o", "-", url]);

        // ffmpeg
        const ffmpeg = spawn(ffmpegPath,
            ["-i", "pipe:0", "-f", "mp3", "-ab", "192k", "pipe:1"]);

        // yt-dlp -> ffmpeg
        ytDlp.stdout.pipe(ffmpeg.stdin);

        // ffmpeg -> navegador
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

        // PEGAR TÍTULO
        const getTitulo = spawn(ytDlpPath, ["--print", "%(uploader)s - %(title)s", url]);

        let musicaNome = "";

        getTitulo.stdout.on("data", data => {
            musicaNome += data.toString();
        });

        getTitulo.on("close", () => {
            // LIMPAR NOME
            musicaNome = musicaNome.trim()
                // remover caracteres inválidos
                .replace(/[\\/:*?"<>|]/g, "")

                // remover emojis
                .replace(/[\u{1F600}-\u{1F6FF}]/gu, "")

                // remover caracteres estranhos
                .replace(/[^\w\s.-]/gi, "")

                // limitar tamanho
                .substring(0, 120);

            if (!musicaNome) {
                musicaNome = "Fleves_Music_Deby";
            }

            // HEADERS DEVEM FICAR AQUI
            res.setHeader("Content-Disposition", `attachment; filename="${musicaNome}.mp3"`);

            res.setHeader("Content-Type", "audio/mpeg");

            // DOWNLOAD
            const ytDlp = spawn(ytDlpPath, ["-x", "--audio-format", "mp3", "-o", "-", url]);

            ytDlp.stdout.pipe(res);

            ytDlp.stderr.on("data", data => {
                console.log("yt-dlp erro:", data.toString());
            });

        });

    } catch (err) {
        console.log(err);

        res.status(500).send("Erro download");
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Fleves Music: http://localhost:${PORT}`);
});
