import express, { Request, Response, NextFunction, } from 'express';
import axios, { AxiosResponse, AxiosError } from 'axios';
import dotenv from "dotenv"
dotenv.config()

const app = express();
const PORT = 3001;
const MAX_CONCURRENCY = process.env.MAX_CONCURRENCY? parseInt(process.env.MAX_CONCURRENCY) : 2
let activeRequests = 0;
interface QueueItem {
    res: Response;
    text: string;
}
const requestQueue: QueueItem[] = []

console.log(process.env)
// Middleware to manually set CORS headers
app.use((req: Request, res: Response, next: NextFunction) => {
    res.header('Access-Control-Allow-Origin', 'http://localhost:3000'); // Update to match the domain you will make the requests from
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Content-Type');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');

    // Handle preflight requests for POST requests, browsers send an OPTIONS request first
    if (req.method === 'OPTIONS') {
        // Send response with allowed methods
        res.header('Access-Control-Allow-Methods', 'POST');
        return res.status(200).json({});
    }

    next();
});

app.use(express.raw({
    type: 'application/octet-stream',
    limit: '50mb'
}));

app.post('/upload', (req: Request, res: Response) => {
    console.log('Received audio data length:', req.body.length);

    var options = {
        method: 'POST',
        url: `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCT_ID}/ai/run/@cf/openai/whisper`,
        headers: { 'Content-Type': 'application/octet-stream', Authorization: 'Bearer ' + process.env.CLOUDFLARE_API_KEY },
        data: req.body
    };
    axios.request(options).then(function (response: AxiosResponse) {
        console.log(`Received STT: ${response.data.result.text}`)
        res.status(200).json(response.data);
    }).catch(function (error: AxiosError) {
        console.error(error.message);
    });

});// Process the TTS request
async function processTTS(text: string): Promise<Buffer> {
    console.log(`Processing tts for message: ${text}`)
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID}`;
    const requestData = {
        text: text,
        model_id: process.env.ELEVENLABS_MODEL_ID,
        voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5
        }
    };

    try {
        const response = await axios({
            method: 'POST',
            url: url,
            headers: {
                'Content-Type': 'application/json',
                'xi-api-key': process.env.ELEVENLABS_API_KEY,
                'Accept': 'audio/mpeg'
            },
            data: requestData,
            responseType: 'arraybuffer'
        });

        if (response.status === 200) {
            return Buffer.from(response.data);
        } else {
            throw new Error('Failed to fetch audio');
        }
    } catch (error) {
        console.error('Error fetching audio:', error);
        throw error;
    }
}

// Function to process the next item in the queue
function processNextRequest(): void {
    if (requestQueue.length > 0 && activeRequests < MAX_CONCURRENCY) {
        const { res, text } = requestQueue.shift()!;
        activeRequests++;
        processTTS(text).then(buffer => {
            res.type('audio/mpeg').send(buffer);
            activeRequests--;
            processNextRequest();
        }).catch(error => {
            res.status(500).send('Error processing TTS request');
            activeRequests--;
            processNextRequest();
        });
    }
}
app.use(express.json())
// API endpoint to handle TTS requests
app.post('/tts', (req: Request, res: Response) => {
    if (activeRequests >= MAX_CONCURRENCY) {
        // Add to queue
        requestQueue.push({ res, text: req.body.text });
    } else {
        activeRequests++;
        processTTS(req.body.text).then(buffer => {
            res.type('audio/mpeg').send(buffer);
            activeRequests--;
            processNextRequest();
        }).catch(error => {
            res.status(500).send('Error processing TTS request');
            activeRequests--;
            processNextRequest();
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
