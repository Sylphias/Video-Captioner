# Eigen Video Editor

# Install all workspace dependencies
install-deps:
    npm install

# Start the backend server (port 3001)
backend:
    node --experimental-strip-types packages/backend/src/index.ts

# Start the frontend dev server (port 5173)
frontend:
    cd packages/frontend && npx vite --host

# Start both services (backend in background, frontend in foreground)
dev:
    #!/usr/bin/env bash
    node --experimental-strip-types packages/backend/src/index.ts &
    BACKEND_PID=$!
    trap "kill $BACKEND_PID 2>/dev/null" EXIT
    cd packages/frontend && npx vite --host
