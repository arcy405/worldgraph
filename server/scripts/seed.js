const mongoose = require('mongoose');
require('dotenv').config();
const Node = require('../models/Node');
const Edge = require('../models/Edge');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/worldgraph';

const seedData = {
  nodes: [
    // AI Research Domain
    { label: "Alan Turing", group: "Person", year: 1950, info: "Father of computer science and AI, proposed the Turing Test", tags: ["AI", "Computer Science", "Foundational"], workspace: "default" },
    { label: "John McCarthy", group: "Person", year: 1956, info: "Coined the term 'Artificial Intelligence', organized Dartmouth Conference", tags: ["AI", "Foundational"], workspace: "default" },
    { label: "Marvin Minsky", group: "Person", year: 1956, info: "AI pioneer, co-founder of MIT AI Lab", tags: ["AI", "Neural Networks"], workspace: "default" },
    { label: "Geoffrey Hinton", group: "Person", year: 1986, info: "Godfather of deep learning, backpropagation pioneer", tags: ["AI", "Deep Learning", "Neural Networks"], workspace: "default" },
    { label: "Yann LeCun", group: "Person", year: 1989, info: "CNN inventor, Facebook AI Research director", tags: ["AI", "Computer Vision", "Deep Learning"], workspace: "default" },
    { label: "Yoshua Bengio", group: "Person", year: 1991, info: "Deep learning pioneer, Turing Award winner", tags: ["AI", "Deep Learning", "NLP"], workspace: "default" },
    { label: "Andrew Ng", group: "Person", year: 2000, info: "Coursera co-founder, AI education pioneer", tags: ["AI", "Education", "ML"], workspace: "default" },
    { label: "Fei-Fei Li", group: "Person", year: 2006, info: "ImageNet creator, computer vision expert", tags: ["AI", "Computer Vision", "ImageNet"], workspace: "default" },
    { label: "Demis Hassabis", group: "Person", year: 2010, info: "DeepMind co-founder and CEO", tags: ["AI", "DeepMind", "Game AI"], workspace: "default" },
    { label: "Sam Altman", group: "Person", year: 2015, info: "OpenAI CEO, GPT series leader", tags: ["AI", "OpenAI", "LLM"], workspace: "default" },
    { label: "Ilya Sutskever", group: "Person", year: 2012, info: "OpenAI co-founder, transformer co-author", tags: ["AI", "OpenAI", "Transformers"], workspace: "default" },
    
    // Organizations
    { label: "MIT", group: "Organization", year: 1861, info: "Massachusetts Institute of Technology, leading AI research", tags: ["Education", "Research", "AI"], workspace: "default" },
    { label: "Stanford University", group: "Organization", year: 1885, info: "Leading AI research institution", tags: ["Education", "Research", "AI"], workspace: "default" },
    { label: "Google", group: "Organization", year: 1998, info: "Tech giant, major AI investments", tags: ["Tech", "AI", "Search"], workspace: "default" },
    { label: "DeepMind", group: "Organization", year: 2010, info: "AI research lab, AlphaGo creator", tags: ["AI", "Research", "Game AI"], workspace: "default" },
    { label: "OpenAI", group: "Organization", year: 2015, info: "AI research company, GPT creator", tags: ["AI", "Research", "LLM"], workspace: "default" },
    { label: "Facebook", group: "Organization", year: 2004, info: "Social media, AI research", tags: ["Tech", "Social Media", "AI"], workspace: "default" },
    { label: "Microsoft", group: "Organization", year: 1975, info: "Tech company, AI investments", tags: ["Tech", "Software", "AI"], workspace: "default" },
    { label: "Tesla", group: "Organization", year: 2003, info: "Electric vehicles, autonomous driving", tags: ["Tech", "Automotive", "AI"], workspace: "default" },
    { label: "NVIDIA", group: "Organization", year: 1993, info: "GPU manufacturer, AI hardware leader", tags: ["Tech", "Hardware", "AI"], workspace: "default" },
    
    // Key Papers
    { label: "Turing Test Paper", group: "Paper", year: 1950, info: "Turing's 'Computing Machinery and Intelligence'", tags: ["AI", "Foundational", "Philosophy"], workspace: "default" },
    { label: "Perceptron Paper", group: "Paper", year: 1958, info: "Rosenblatt's perceptron algorithm", tags: ["AI", "Neural Networks", "Foundational"], workspace: "default" },
    { label: "Backpropagation Paper", group: "Paper", year: 1986, info: "Rumelhart et al. on backpropagation", tags: ["AI", "Neural Networks", "Deep Learning"], workspace: "default" },
    { label: "ImageNet Paper", group: "Paper", year: 2009, info: "Fei-Fei Li's ImageNet dataset", tags: ["AI", "Computer Vision", "Dataset"], workspace: "default" },
    { label: "AlexNet Paper", group: "Paper", year: 2012, info: "Krizhevsky et al. deep learning breakthrough", tags: ["AI", "Deep Learning", "Computer Vision"], workspace: "default" },
    { label: "Transformer Paper", group: "Paper", year: 2017, info: "Vaswani et al. 'Attention Is All You Need'", tags: ["AI", "NLP", "Transformers"], workspace: "default" },
    { label: "BERT Paper", group: "Paper", year: 2018, info: "Devlin et al. bidirectional encoder", tags: ["AI", "NLP", "BERT"], workspace: "default" },
    { label: "GPT-2 Paper", group: "Paper", year: 2019, info: "Radford et al. language model", tags: ["AI", "NLP", "GPT"], workspace: "default" },
    { label: "GPT-3 Paper", group: "Paper", year: 2020, info: "Brown et al. large language model", tags: ["AI", "NLP", "GPT", "LLM"], workspace: "default" },
    { label: "GPT-4 Paper", group: "Paper", year: 2023, info: "OpenAI's multimodal LLM", tags: ["AI", "NLP", "GPT", "Multimodal"], workspace: "default" },
    { label: "AlphaGo Paper", group: "Paper", year: 2016, info: "DeepMind's Go-playing AI", tags: ["AI", "Game AI", "Reinforcement Learning"], workspace: "default" },
    { label: "AlphaZero Paper", group: "Paper", year: 2017, info: "Self-learning game AI", tags: ["AI", "Game AI", "Self-Learning"], workspace: "default" },
    
    // Key Ideas & Concepts
    { label: "Machine Learning", group: "Idea", year: 1959, info: "Field of study giving computers ability to learn", tags: ["AI", "ML", "Foundational"], workspace: "default" },
    { label: "Neural Networks", group: "Idea", year: 1943, info: "Computing systems inspired by biological neural networks", tags: ["AI", "Neural Networks", "Foundational"], workspace: "default" },
    { label: "Deep Learning", group: "Idea", year: 2006, info: "Multi-layer neural networks", tags: ["AI", "Deep Learning", "Neural Networks"], workspace: "default" },
    { label: "Convolutional Neural Networks", group: "Idea", year: 1989, info: "CNNs for image processing", tags: ["AI", "CNN", "Computer Vision"], workspace: "default" },
    { label: "Recurrent Neural Networks", group: "Idea", year: 1986, info: "RNNs for sequential data", tags: ["AI", "RNN", "Sequential"], workspace: "default" },
    { label: "Attention Mechanism", group: "Idea", year: 2014, info: "Attention in neural networks", tags: ["AI", "Attention", "NLP"], workspace: "default" },
    { label: "Transformers", group: "Idea", year: 2017, info: "Transformer architecture", tags: ["AI", "Transformers", "NLP"], workspace: "default" },
    { label: "Large Language Models", group: "Idea", year: 2018, info: "LLMs for natural language", tags: ["AI", "LLM", "NLP"], workspace: "default" },
    { label: "Reinforcement Learning", group: "Idea", year: 1951, info: "Learning through interaction", tags: ["AI", "RL", "Learning"], workspace: "default" },
    { label: "Computer Vision", group: "Idea", year: 1966, info: "AI for visual understanding", tags: ["AI", "Computer Vision", "Images"], workspace: "default" },
    { label: "Natural Language Processing", group: "Idea", year: 1950, info: "AI for language understanding", tags: ["AI", "NLP", "Language"], workspace: "default" },
    { label: "Generative AI", group: "Idea", year: 2014, info: "AI that generates content", tags: ["AI", "Generative", "Content"], workspace: "default" },
    { label: "AI Safety", group: "Idea", year: 2015, info: "Ensuring AI systems are safe and aligned", tags: ["AI", "Safety", "Ethics"], workspace: "default" },
    { label: "AGI", group: "Idea", year: 2000, info: "Artificial General Intelligence", tags: ["AI", "AGI", "Future"], workspace: "default" },
    
    // Events & Conferences
    { label: "Dartmouth Conference", group: "Event", year: 1956, info: "Birth of AI as a field", tags: ["AI", "History", "Foundational"], workspace: "default" },
    { label: "ImageNet Challenge", group: "Event", year: 2010, info: "Annual computer vision competition", tags: ["AI", "Computer Vision", "Competition"], workspace: "default" },
    { label: "AlphaGo vs Lee Sedol", group: "Event", year: 2016, info: "Historic Go match, AI victory", tags: ["AI", "Game AI", "Milestone"], workspace: "default" },
    { label: "ChatGPT Launch", group: "Event", year: 2022, info: "ChatGPT public release", tags: ["AI", "LLM", "Milestone"], workspace: "default" },
    { label: "GPT-4 Release", group: "Event", year: 2023, info: "GPT-4 public release", tags: ["AI", "LLM", "Milestone"], workspace: "default" },
    { label: "NeurIPS 2023", group: "Event", year: 2023, info: "Leading AI conference", tags: ["AI", "Conference", "Research"], workspace: "default" },
    { label: "ICML 2023", group: "Event", year: 2023, info: "International Conference on Machine Learning", tags: ["AI", "Conference", "ML"], workspace: "default" },
    
    // Additional Historical Figures
    { label: "Ada Lovelace", group: "Person", year: 1843, info: "First computer programmer", tags: ["Computer Science", "History", "Foundational"], workspace: "default" },
    { label: "Claude Shannon", group: "Person", year: 1948, info: "Information theory founder", tags: ["Computer Science", "Information Theory"], workspace: "default" },
    { label: "John von Neumann", group: "Person", year: 1945, info: "Computer architecture pioneer", tags: ["Computer Science", "Architecture"], workspace: "default" },
    { label: "Herbert Simon", group: "Person", year: 1956, info: "AI and cognitive science pioneer", tags: ["AI", "Cognitive Science"], workspace: "default" },
    { label: "Allen Newell", group: "Person", year: 1956, info: "AI pioneer, cognitive science", tags: ["AI", "Cognitive Science"], workspace: "default" },
    
    // Modern AI Researchers
    { label: "Ian Goodfellow", group: "Person", year: 2014, info: "GANs inventor", tags: ["AI", "GANs", "Generative"], workspace: "default" },
    { label: "Jürgen Schmidhuber", group: "Person", year: 1997, info: "LSTM inventor, deep learning pioneer", tags: ["AI", "LSTM", "Deep Learning"], workspace: "default" },
    { label: "David Silver", group: "Person", year: 2016, info: "AlphaGo lead researcher", tags: ["AI", "DeepMind", "Game AI"], workspace: "default" },
    { label: "Dario Amodei", group: "Person", year: 2015, info: "Anthropic co-founder, AI safety", tags: ["AI", "Safety", "Anthropic"], workspace: "default" },
    { label: "Daniela Amodei", group: "Person", year: 2021, info: "Anthropic co-founder", tags: ["AI", "Anthropic"], workspace: "default" },
    
    // Additional Organizations
    { label: "Anthropic", group: "Organization", year: 2021, info: "AI safety research company", tags: ["AI", "Safety", "Research"], workspace: "default" },
    { label: "Cohere", group: "Organization", year: 2019, info: "Enterprise AI company", tags: ["AI", "Enterprise", "LLM"], workspace: "default" },
    { label: "Stability AI", group: "Organization", year: 2020, info: "Open-source AI, Stable Diffusion", tags: ["AI", "Open Source", "Generative"], workspace: "default" },
    { label: "Midjourney", group: "Organization", year: 2022, info: "AI image generation", tags: ["AI", "Generative", "Images"], workspace: "default" },
    
    // Additional Papers
    { label: "ResNet Paper", group: "Paper", year: 2015, info: "He et al. residual networks", tags: ["AI", "Deep Learning", "Computer Vision"], workspace: "default" },
    { label: "GAN Paper", group: "Paper", year: 2014, info: "Goodfellow et al. generative adversarial networks", tags: ["AI", "GANs", "Generative"], workspace: "default" },
    { label: "LSTM Paper", group: "Paper", year: 1997, info: "Hochreiter & Schmidhuber LSTM", tags: ["AI", "LSTM", "RNN"], workspace: "default" },
    { label: "Word2Vec Paper", group: "Paper", year: 2013, info: "Mikolov et al. word embeddings", tags: ["AI", "NLP", "Embeddings"], workspace: "default" },
    { label: "Stable Diffusion Paper", group: "Paper", year: 2022, info: "Rombach et al. text-to-image", tags: ["AI", "Generative", "Images"], workspace: "default" },
    
    // Additional Ideas
    { label: "GANs", group: "Idea", year: 2014, info: "Generative Adversarial Networks", tags: ["AI", "GANs", "Generative"], workspace: "default" },
    { label: "Diffusion Models", group: "Idea", year: 2020, info: "Generative models using diffusion", tags: ["AI", "Generative", "Diffusion"], workspace: "default" },
    { label: "Prompt Engineering", group: "Idea", year: 2021, info: "Technique for optimizing LLM prompts", tags: ["AI", "LLM", "Technique"], workspace: "default" },
    { label: "Few-Shot Learning", group: "Idea", year: 2003, info: "Learning from few examples", tags: ["AI", "Learning", "Technique"], workspace: "default" },
    { label: "Transfer Learning", group: "Idea", year: 1995, info: "Applying knowledge across domains", tags: ["AI", "Learning", "Technique"], workspace: "default" },
  ],
  edges: [
    // Foundational connections
    { fromLabel: "Alan Turing", toLabel: "Turing Test Paper", label: "authored" },
    { fromLabel: "John McCarthy", toLabel: "Dartmouth Conference", label: "organized" },
    { fromLabel: "Marvin Minsky", toLabel: "Dartmouth Conference", label: "attended" },
    { fromLabel: "Dartmouth Conference", toLabel: "Machine Learning", label: "established" },
    { fromLabel: "Dartmouth Conference", toLabel: "Neural Networks", label: "discussed" },
    
    // Deep Learning connections
    { fromLabel: "Geoffrey Hinton", toLabel: "Backpropagation Paper", label: "co-authored" },
    { fromLabel: "Backpropagation Paper", toLabel: "Deep Learning", label: "enabled" },
    { fromLabel: "Geoffrey Hinton", toLabel: "Deep Learning", label: "pioneered" },
    { fromLabel: "Yann LeCun", toLabel: "Convolutional Neural Networks", label: "invented" },
    { fromLabel: "Yann LeCun", toLabel: "CNN Paper", label: "authored" },
    { fromLabel: "Yoshua Bengio", toLabel: "Deep Learning", label: "pioneered" },
    { fromLabel: "Geoffrey Hinton", toLabel: "Yann LeCun", label: "collaborated_with" },
    { fromLabel: "Geoffrey Hinton", toLabel: "Yoshua Bengio", label: "collaborated_with" },
    
    // ImageNet and Computer Vision
    { fromLabel: "Fei-Fei Li", toLabel: "ImageNet Paper", label: "authored" },
    { fromLabel: "Fei-Fei Li", toLabel: "ImageNet Challenge", label: "created" },
    { fromLabel: "ImageNet Paper", toLabel: "AlexNet Paper", label: "enabled" },
    { fromLabel: "AlexNet Paper", toLabel: "Deep Learning", label: "revolutionized" },
    { fromLabel: "Fei-Fei Li", toLabel: "Stanford University", label: "affiliated_with" },
    { fromLabel: "AlexNet Paper", toLabel: "Computer Vision", label: "transformed" },
    
    // Transformers and NLP
    { fromLabel: "Ilya Sutskever", toLabel: "Transformer Paper", label: "co-authored" },
    { fromLabel: "Transformer Paper", toLabel: "Transformers", label: "introduced" },
    { fromLabel: "Transformers", toLabel: "Attention Mechanism", label: "uses" },
    { fromLabel: "Transformer Paper", toLabel: "BERT Paper", label: "inspired" },
    { fromLabel: "BERT Paper", toLabel: "Large Language Models", label: "pioneered" },
    { fromLabel: "Transformer Paper", toLabel: "GPT-2 Paper", label: "inspired" },
    { fromLabel: "GPT-2 Paper", toLabel: "GPT-3 Paper", label: "preceded" },
    { fromLabel: "GPT-3 Paper", toLabel: "GPT-4 Paper", label: "preceded" },
    { fromLabel: "GPT-3 Paper", toLabel: "ChatGPT Launch", label: "powered" },
    { fromLabel: "GPT-4 Paper", toLabel: "GPT-4 Release", label: "announced" },
    { fromLabel: "OpenAI", toLabel: "GPT-2 Paper", label: "published" },
    { fromLabel: "OpenAI", toLabel: "GPT-3 Paper", label: "published" },
    { fromLabel: "OpenAI", toLabel: "GPT-4 Paper", label: "published" },
    { fromLabel: "OpenAI", toLabel: "ChatGPT Launch", label: "launched" },
    { fromLabel: "Sam Altman", toLabel: "OpenAI", label: "leads" },
    { fromLabel: "Ilya Sutskever", toLabel: "OpenAI", label: "co-founded" },
    
    // Game AI
    { fromLabel: "DeepMind", toLabel: "AlphaGo Paper", label: "published" },
    { fromLabel: "AlphaGo Paper", toLabel: "AlphaGo vs Lee Sedol", label: "enabled" },
    { fromLabel: "AlphaGo vs Lee Sedol", toLabel: "Reinforcement Learning", label: "showcased" },
    { fromLabel: "DeepMind", toLabel: "AlphaZero Paper", label: "published" },
    { fromLabel: "AlphaZero Paper", toLabel: "AlphaGo Paper", label: "improved" },
    { fromLabel: "David Silver", toLabel: "AlphaGo Paper", label: "co-authored" },
    { fromLabel: "Demis Hassabis", toLabel: "DeepMind", label: "co-founded" },
    { fromLabel: "Google", toLabel: "DeepMind", label: "acquired" },
    
    // Organizations and People
    { fromLabel: "Geoffrey Hinton", toLabel: "Google", label: "joined" },
    { fromLabel: "Yann LeCun", toLabel: "Facebook", label: "joined" },
    { fromLabel: "Fei-Fei Li", toLabel: "Google", label: "worked_at" },
    { fromLabel: "Andrew Ng", toLabel: "Stanford University", label: "affiliated_with" },
    { fromLabel: "Andrew Ng", toLabel: "Google", label: "worked_at" },
    { fromLabel: "Yoshua Bengio", toLabel: "MIT", label: "affiliated_with" },
    
    // Research Institutions
    { fromLabel: "MIT", toLabel: "Neural Networks", label: "researched" },
    { fromLabel: "Stanford University", toLabel: "Computer Vision", label: "researched" },
    { fromLabel: "Stanford University", toLabel: "Natural Language Processing", label: "researched" },
    
    // Historical connections
    { fromLabel: "Ada Lovelace", toLabel: "Computer Science", label: "pioneered" },
    { fromLabel: "Claude Shannon", toLabel: "Information Theory", label: "founded" },
    { fromLabel: "John von Neumann", toLabel: "Computer Architecture", label: "designed" },
    { fromLabel: "Herbert Simon", toLabel: "Dartmouth Conference", label: "attended" },
    { fromLabel: "Allen Newell", toLabel: "Dartmouth Conference", label: "attended" },
    
    // Modern AI connections
    { fromLabel: "Ian Goodfellow", toLabel: "GAN Paper", label: "authored" },
    { fromLabel: "GAN Paper", toLabel: "GANs", label: "introduced" },
    { fromLabel: "GANs", toLabel: "Generative AI", label: "enabled" },
    { fromLabel: "Jürgen Schmidhuber", toLabel: "LSTM Paper", label: "co-authored" },
    { fromLabel: "LSTM Paper", toLabel: "Recurrent Neural Networks", label: "advanced" },
    { fromLabel: "Dario Amodei", toLabel: "Anthropic", label: "co-founded" },
    { fromLabel: "Daniela Amodei", toLabel: "Anthropic", label: "co-founded" },
    { fromLabel: "Anthropic", toLabel: "AI Safety", label: "focuses_on" },
    
    // Generative AI
    { fromLabel: "Stable Diffusion Paper", toLabel: "Stability AI", label: "published_by" },
    { fromLabel: "Stable Diffusion Paper", toLabel: "Diffusion Models", label: "uses" },
    { fromLabel: "Diffusion Models", toLabel: "Generative AI", label: "advanced" },
    { fromLabel: "Midjourney", toLabel: "Generative AI", label: "uses" },
    { fromLabel: "Stability AI", toLabel: "Generative AI", label: "develops" },
    
    // Additional paper connections
    { fromLabel: "ResNet Paper", toLabel: "Deep Learning", label: "advanced" },
    { fromLabel: "ResNet Paper", toLabel: "Computer Vision", label: "improved" },
    { fromLabel: "Word2Vec Paper", toLabel: "Natural Language Processing", label: "advanced" },
    { fromLabel: "Word2Vec Paper", toLabel: "Large Language Models", label: "influenced" },
    
    // Idea connections
    { fromLabel: "Machine Learning", toLabel: "Deep Learning", label: "includes" },
    { fromLabel: "Neural Networks", toLabel: "Deep Learning", label: "enables" },
    { fromLabel: "Convolutional Neural Networks", toLabel: "Computer Vision", label: "powers" },
    { fromLabel: "Recurrent Neural Networks", toLabel: "Natural Language Processing", label: "powers" },
    { fromLabel: "Attention Mechanism", toLabel: "Transformers", label: "enables" },
    { fromLabel: "Transformers", toLabel: "Large Language Models", label: "enables" },
    { fromLabel: "Large Language Models", toLabel: "Generative AI", label: "includes" },
    { fromLabel: "Reinforcement Learning", toLabel: "Game AI", label: "powers" },
    { fromLabel: "AI Safety", toLabel: "AGI", label: "addresses" },
    
    // Conference connections
    { fromLabel: "NeurIPS 2023", toLabel: "AI Research", label: "showcases" },
    { fromLabel: "ICML 2023", toLabel: "Machine Learning", label: "showcases" },
    { fromLabel: "NeurIPS 2023", toLabel: "Deep Learning", label: "features" },
    
    // Tech company connections
    { fromLabel: "NVIDIA", toLabel: "Deep Learning", label: "enables" },
    { fromLabel: "NVIDIA", toLabel: "GPU", label: "manufactures" },
    { fromLabel: "Tesla", toLabel: "Computer Vision", label: "uses" },
    { fromLabel: "Tesla", toLabel: "Autonomous Driving", label: "develops" },
    { fromLabel: "Microsoft", toLabel: "OpenAI", label: "invested_in" },
    { fromLabel: "Cohere", toLabel: "Large Language Models", label: "develops" },
    
    // Technique connections
    { fromLabel: "Few-Shot Learning", toLabel: "Large Language Models", label: "enables" },
    { fromLabel: "Transfer Learning", toLabel: "Deep Learning", label: "uses" },
    { fromLabel: "Prompt Engineering", toLabel: "Large Language Models", label: "optimizes" },
    
    // Cross-domain connections
    { fromLabel: "Computer Vision", toLabel: "Autonomous Driving", label: "enables" },
    { fromLabel: "Natural Language Processing", toLabel: "ChatGPT Launch", label: "enabled" },
    { fromLabel: "Game AI", toLabel: "Reinforcement Learning", label: "demonstrates" },
  ]
};

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing data
    await Node.deleteMany({});
    await Edge.deleteMany({});
    console.log('Cleared existing data');

    // Insert nodes
    const insertedNodes = await Node.insertMany(seedData.nodes);
    console.log(`Inserted ${insertedNodes.length} nodes`);

    // Create a map of label to node ID
    const nodeMap = {};
    insertedNodes.forEach(node => {
      nodeMap[node.label] = node._id;
    });

    // Insert edges with proper node references
    const edgesToInsert = seedData.edges
      .filter(edge => nodeMap[edge.fromLabel] && nodeMap[edge.toLabel])
      .map(edge => ({
      from: nodeMap[edge.fromLabel],
      to: nodeMap[edge.toLabel],
        label: edge.label,
        weight: edge.weight || 1,
        workspace: 'default'
    }));

    const insertedEdges = await Edge.insertMany(edgesToInsert);
    console.log(`Inserted ${insertedEdges.length} edges`);

    console.log('Seed data inserted successfully!');
    console.log(`\nGraph Statistics:`);
    console.log(`- Nodes: ${insertedNodes.length}`);
    console.log(`- Edges: ${insertedEdges.length}`);
    console.log(`- Entity Types: ${[...new Set(insertedNodes.map(n => n.group))].join(', ')}`);
    console.log(`- Year Range: ${Math.min(...insertedNodes.filter(n => n.year).map(n => n.year))} - ${Math.max(...insertedNodes.filter(n => n.year).map(n => n.year))}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

seed();
