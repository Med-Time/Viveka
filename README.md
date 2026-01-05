# Viveka: Agentic AI for Personalized Learning

![Project Status](https://img.shields.io/badge/status-active-success.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Tech Stack](https://img.shields.io/badge/stack-MERN%20%2B%20Python%20AI-orange.svg)

**Viveka** is an advanced, adaptive learning platform powered by Agentic AI. Unlike traditional LMS platforms that serve static content, Viveka uses a multi-agent orchestration engine to interview learners, diagnose knowledge gaps, generate personalized lesson plans, and create real-time instructional content grounded in verified educational resources.

## 🚀 Key Features

* **🗣️ Diagnostic Interview Agent:** Conducts a voice-enabled, adaptive interview to assess baseline knowledge using a Finite State Machine (LangGraph).
* **🧠 Dynamic Persona Modeling:** Builds and maintains an evolving learner profile (Persona) based on behavior, confidence, and response patterns.
* **aaS Lesson Generation:** Creates custom hierarchical lesson plans and generates canonical learning content on-demand.
* **📚 RAG-Powered Instruction:** Uses Retrieval-Augmented Generation (RAG) with **Qdrant** to ground AI responses in verified textbook material, minimizing hallucinations.
* **🤖 Topic-Scoped AI Tutor:** A conversational assistant that provides real-time help, strictly scoped to the current module's context.
* **📝 Automated Assessment:** Generates quizzes and assignments directly from the lesson content and evaluates them semantically (not just keyword matching).
* **🎓 Certification:** Issues verifiable certificates upon the mastery of a subject.

## 🛠️ Tech Stack

### **Frontend (Client)**
* **Framework:** React (Vite)
* **Language:** TypeScript
* **Styling:** TailwindCSS + Shadcn/UI
* **State/API:** React Query, Axios
* **Speech:** Web Speech API for Speech-to-Text

### **Backend (Server)**
* **Framework:** FastAPI (Python)
* **Orchestration:** LangGraph (State-based Agent workflows)
* **AI Model:** Google Gemini (via Google Generative AI SDK)
* **Database:** MongoDB (User data, Plans, Progress)
* **Vector Store:** Qdrant (Semantic Embeddings for RAG)

## 📂 Project Structure

```bash
Viveka/
├── .github/              # CI/CD Workflows
├── client/               # React Frontend Application
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   ├── features/     # Feature-based modules (Interview, Plan, Persona)
│   │   └── hooks/        # Custom React hooks
├── server/               # Python FastAPI Backend
│   ├── assistant_module/ # Chatbot Logic
│   ├── interview_module/ # LangGraph Diagnostic Interview Logic
│   ├── content_module/   # RAG & Content Generation
│   ├── core/             # Database & Worker Config
│   └── preprocessing/    # PDF Parsing & Vector Embedding Scripts

```

## ⚡ Getting Started

### Prerequisites

* Node.js (v18+)
* Python (v3.10+)
* MongoDB (Local or Atlas)
* Qdrant (Docker container recommended)

### 1. Backend Setup

Navigate to the server directory and set up the environment.

```bash
cd server

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env
# Update .env with your keys:
# GEMINI_API_KEY=...
# MONGO_URI=...
# QDRANT_URL=...

```

**Run the Server:**

```bash
uvicorn main:app --reload

```

The API will be available at `http://localhost:8000`.

### 2. Frontend Setup

Navigate to the client directory.

```bash
cd client

# Install dependencies
npm install

# Create .env file
cp env.example .env
# Set VITE_API_URL=http://localhost:8000

# Run the development server
npm run dev

```

The application will be running at `http://localhost:5173`.

### 3. Vector Database Setup (RAG)

To enable the AI to teach specific subjects (e.g., Operating Systems), you must ingest the content into Qdrant.

```bash
# Ensure Qdrant is running (e.g., via Docker)
docker run -p 6333:6333 qdrant/qdrant

# Run the preprocessing script
cd server/preprocessing/qdrant
python Embed_and_VectorStore/embed_vectordb.py

```

## 🐳 Docker Deployment

The project includes a Dockerfile for the backend.

```bash
cd server
docker build -t viveka-backend .
docker run -p 8000:8000 --env-file .env viveka-backend

```

## 🧠 Architecture Insight: The Interview Graph

The core of Viveka is the **LangGraph** orchestration engine. Instead of linear code, the learning process is modeled as a graph:

1. **CheckDocs:** Checks if RAG material is available.
2. **GenerateCurriculum:** Creates a roadmap based on user goals.
3. **AskQuestion:** Generates an adaptive question.
4. **ScoreAnswer:** Semantically evaluates the response.
5. **DecideNext:** Logic node that decides whether to advance, remediate, or end the session.

*See `server/interview_module/langraph_flow/interview_graph.py` for implementation details.*

## 🤝 Contributing

Contributions are welcome! Please fork the repository and create a pull request.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
