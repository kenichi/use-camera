# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm run build` - Compile TypeScript to JavaScript in dist/
- `npm run dev` - Build in watch mode for development
- `npm test` - Run Jest tests once
- `npm test:watch` - Run Jest tests in watch mode
- `npm run prepublishOnly` - Build before publishing (runs automatically)

## Architecture

This is a React hook library (`@poscam/use-camera`) that provides camera functionality with Phoenix WebSocket integration.

### Core Components

- **useCamera hook** (`src/useCamera.ts`): Main hook that manages camera state, WebSocket connections, and API communication
- **Types** (`src/types.ts`): TypeScript interfaces and enums for the library
- **Index** (`src/index.ts`): Public API exports

### Integration Pattern

The hook follows a two-step initialization pattern:
1. HTTP POST to `/api/cameras` endpoint to create camera session and get QR code
2. WebSocket connection to `camera:channel:{code}` for real-time state updates and image streaming

### Key Dependencies

- Peer dependencies: React ^19.0.0, Phoenix ^1.7.0
- Test setup uses Jest with jsdom environment and React Testing Library
- TypeScript compilation targets ES2020 with CommonJS modules

### State Management

Camera states flow through: `WAITING` → `CONNECTED` → `CLOSED`
The hook manages WebSocket lifecycle automatically, disconnecting when camera closes.