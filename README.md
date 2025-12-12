# GEDCOM_Gemini
GEDCOM Compare tool made using Gemini

## Overview

This is a React-based web application that allows you to upload and compare two GEDCOM (genealogy) files side-by-side. The application parses individual records and highlights differences based on human-meaningful data (name, sex, birth details).

**Note**: The Gemini API integration for bio generation has been removed. The API_KEY field in the code is a placeholder and is not currently used.

## Docker Deployment

This application can be easily deployed using Docker.

### Prerequisites
- Docker installed on your system
- Docker Compose (optional, but recommended)

### Quick Start with Docker Compose

1. Clone the repository:
```bash
git clone https://github.com/georgemoore/GEDCOM_Gemini.git
cd GEDCOM_Gemini
```

2. Build and run with Docker Compose:
```bash
docker-compose up -d
```

3. Access the application at `http://localhost:3000`

4. To stop the application:
```bash
docker-compose down
```

### Manual Docker Build and Run

If you prefer not to use Docker Compose:

1. Build the Docker image:
```bash
docker build -t gedcom-gemini .
```

2. Run the container:
```bash
docker run -d -p 3000:3000 --name gedcom-gemini-app gedcom-gemini
```

3. Access the application at `http://localhost:3000`

4. To stop the container:
```bash
docker stop gedcom-gemini-app
docker rm gedcom-gemini-app
```

### Configuration

- The application runs on port 3000 by default
- To use a different port, modify the port mapping in `docker-compose.yml` or the `docker run` command
- Example for port 8080: `-p 8080:3000`

### CI/Testing Environments

If you encounter SSL certificate issues in corporate or CI environments, you can use the alternative CI configuration:

**Option 1: Using Docker Compose**
```bash
docker compose -f docker-compose.ci.yml up -d
```

**Option 2: Using Docker directly**
```bash
docker build -f Dockerfile.ci -t gedcom-gemini .
docker run -d -p 3000:3000 gedcom-gemini
```

**Warning**: The CI configuration (`Dockerfile.ci` and `docker-compose.ci.yml`) disables SSL verification and should ONLY be used in trusted CI/testing environments, never for production builds.

## Local Development

To run the application locally without Docker:

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Access the application at `http://localhost:3000`
