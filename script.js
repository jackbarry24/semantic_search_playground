const fileInput = document.getElementById('fileInput');
const resultsDiv = document.getElementById('results');
const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressBar');
const loadingMessage = document.getElementById('loadingMessage');
const progressText = document.getElementById('progressText');
const searchButton = document.getElementById('searchButton');
const preprocessButton = document.getElementById('preprocessButton');
let textChunks = [];
let embeddings = [];
let model;
let curr_files = []; // Initialize curr_files as an empty array


async function loadModel() {
    loadingMessage.style.display = 'block';
    model = await use.load();
    loadingMessage.textContent = 'Model loaded! You can now upload your files.';
}


function updateProgressBar(progress, step, fileName) {
    progressBar.style.width = `${progress}%`;
    progressText.textContent = `[${progress.toFixed(0)}%] ${step} for ${fileName}`;
    if (progress >= 100) {
        progressText.textContent = 'Preprocessing completed!';
    }
}


function chunkText(text) {
    const chunkingMethod = document.querySelector('input[name="chunkingMethod"]:checked').value;
    let chunks = [];

    if (chunkingMethod === 'sentence') {
        chunks = text.match(/[^\.!\?]+[\.!\?]+/g) || [];
    } else if (chunkingMethod === 'newline') {
        chunks = text.split('\n');
    } else if (chunkingMethod === 'fixedSize') {
        const chunkSize = 200;
        const regex = new RegExp(`(.|[\r\n]){1,${chunkSize}}`, 'g');
        chunks = text.match(regex) || [];
    }

    return chunks;
}


function cosineSimilarity(vecA, vecB) {
    const dotProduct = vecA.reduce((sum, val, i) => sum + val * vecB[i], 0);
    const normA = Math.sqrt(vecA.reduce((sum, val) => sum + val * val, 0));
    const normB = Math.sqrt(vecB.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (normA * normB);
}


function euclideanDistance(vecA, vecB) {
    return Math.sqrt(vecA.reduce((sum, val, i) => sum + Math.pow(val - vecB[i], 2), 0));
}


preprocessButton.addEventListener('click', async (event) => {
    const files = curr_files;
    if (files.length === 0) return;
    
    textChunks = [];
    progressContainer.style.display = 'block';
    searchButton.disabled = true;

    for (let i = 0; i < files.length; i++) {
        if (files[i].type === 'text/plain') {
            const text = await files[i].text();
            const chunks = chunkText(text);
            textChunks.push(...chunks);
        }
    }

    embeddings = [];
    for (let index = 0; index < textChunks.length; index++) {
        const embedding = await model.embed(textChunks[index]);
        embeddings.push(embedding);

        updateProgressBar(((index + 1) / textChunks.length) * 100, 'Generating Embeddings', files[0].name);
    }

    updateProgressBar(100, 'Preprocessing Complete', "");
    searchButton.disabled = false;
});


fileInput.addEventListener('change', async (event) => {
    const files = event.target.files;
    if (files.length > 0) {
        curr_files = files;
        preprocessButton.disabled = false; 
    } else {
        preprocessButton.disabled = true; 
    }
});


searchButton.addEventListener('click', async () => {
    const query = document.getElementById('query').value;
    let k = parseInt(document.getElementById('k').value, 10);
    const queryEmbedding = await model.embed(query);

    const similarityMethod = document.querySelector('input[name="similarityMethod"]:checked').value;
    
    const similarities = embeddings.map((embedding, index) => {
        const embeddingArray = embedding.arraySync()[0];
        let score;

        // Calculate similarity based on the selected method
        if (similarityMethod === 'cosine') {
            score = cosineSimilarity(queryEmbedding.arraySync()[0], embeddingArray);
        } else if (similarityMethod === 'euclidean') {
            score = euclideanDistance(queryEmbedding.arraySync()[0], embeddingArray);
            score = 1 / (1 + score); // Inverse to make higher scores better
        }

        return { index, score };
    });

    // Sort by score and get top k results
    similarities.sort((a, b) => b.score - a.score);
    const topK = similarities.slice(0, k);

    // Display results
    resultsDiv.innerHTML = '';
    topK.forEach(result => {
        const chunk = textChunks[result.index];
        const resultDiv = document.createElement('div');
        resultDiv.style.display = 'flex';
        resultDiv.style.alignItems = 'center';
        resultDiv.style.marginBottom = '10px';
        resultDiv.style.borderRadius = '5px';

        const textDiv = document.createElement('div');
        textDiv.style.flex = '1';
        textDiv.textContent = chunk;

        const scoreBox = document.createElement('div');
        scoreBox.style.width = '100px';
        scoreBox.style.height = '30px';
        scoreBox.style.display = 'flex';
        scoreBox.style.alignItems = 'center';
        scoreBox.style.justifyContent = 'center';
        scoreBox.style.borderRadius = '5px';
        scoreBox.style.backgroundColor = getGradientColor(result.score);
        scoreBox.textContent = result.score.toFixed(4);

        

        

        resultDiv.appendChild(textDiv);
        resultDiv.appendChild(scoreBox);
        resultsDiv.appendChild(resultDiv);
    });
});

function getGradientColor(score) {
    const startColor = { r: 255, g: 0, b: 0 }; 
    const endColor = { r: 0, g: 255, b: 0 }; 

    const r = Math.round(startColor.r + (endColor.r - startColor.r) * score);
    const g = Math.round(startColor.g + (endColor.g - startColor.g) * score);
    const b = Math.round(startColor.b + (endColor.b - startColor.b) * score);

    return `rgb(${r}, ${g}, ${b})`;
}

window.onload = loadModel;
