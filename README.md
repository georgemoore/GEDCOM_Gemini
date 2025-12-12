# GEDCOM_Gemini
GEDCOM Compare tool made using Gemini

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
