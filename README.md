# Election Voting Prediction Platform

選挙における投票予定先を事前登録できるリアルタイム投票予想プラットフォーム

## Features

- リアルタイム得票予想の可視化
- 選挙・候補者情報の動的登録（一般ユーザー対応）
- Google OAuth による安全な認証
- 重複投票防止機能
- 投票予定の自由な変更・取り消し

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Backend**: Firebase Functions + Node.js + TypeScript
- **Database**: Firestore
- **Authentication**: Firebase Auth (Google OAuth)
- **Hosting**: Firebase Hosting

## Project Structure

```
├── architecture.md          # System architecture documentation
├── memory.md                # Implementation progress tracking
├── firebase.json            # Firebase project configuration
├── firestore.rules          # Firestore security rules
├── firestore.indexes.json   # Firestore database indexes
├── frontend/                # React frontend application
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── contexts/        # React contexts (Auth, etc.)
│   │   ├── firebase/        # Firebase configuration and services
│   │   ├── pages/           # Page components
│   │   └── types/           # TypeScript type definitions
│   └── package.json
└── functions/               # Firebase Cloud Functions
    ├── src/
    └── package.json
```

## Setup Instructions

### Prerequisites

- Node.js 18+
- Firebase CLI (`npm install -g firebase-tools`)
- Firebase project (create at https://console.firebase.google.com)

### 1. Firebase Project Setup

1. Create a new Firebase project at https://console.firebase.google.com
2. Enable Authentication (Google provider)
3. Create a Firestore database
4. Get your Firebase config from Project Settings

### 2. Local Development Setup

1. Clone and setup the project:
   ```bash
   cd frontend
   npm install
   ```

2. Configure Firebase:
   ```bash
   # Login to Firebase
   firebase login
   
   # Initialize Firebase project (if not already done)
   firebase init
   ```

3. Update Firebase configuration:
   - Edit `frontend/src/firebase/config.ts`
   - Replace placeholder values with your Firebase project config

### 3. Development Mode

#### Frontend Only (with Mock Data)
```bash
cd frontend
npm run dev
```
The app will run with mock data if Firebase is not configured.

#### Full Stack Development
```bash
# Terminal 1: Start Firebase emulators
firebase emulators:start

# Terminal 2: Start frontend development server
cd frontend
npm run dev
```

### 4. Production Deployment

1. Build the frontend:
   ```bash
   cd frontend
   npm run build
   ```

2. Deploy to Firebase:
   ```bash
   # Deploy everything
   firebase deploy

   # Or deploy specific services
   firebase deploy --only hosting
   firebase deploy --only firestore:rules
   firebase deploy --only functions
   ```

## Configuration

### Environment Variables

Create a `.env.local` file in the frontend directory to configure Firebase:
```bash
# Firebase Configuration - Use your actual Firebase project settings
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
VITE_FIREBASE_APP_ID=your-app-id

# Emulator Settings (granular control)
# Auth Emulator - Set to false for real Google authentication
VITE_USE_AUTH_EMULATOR=false
# Firestore Emulator - Set to true for local development
VITE_USE_FIRESTORE_EMULATOR=true

# Legacy environment variable (for backwards compatibility)
VITE_USE_FIREBASE_EMULATOR=false
```

**Development Configuration**:
- `VITE_USE_AUTH_EMULATOR=false`: Uses real Google accounts for authentication
- `VITE_USE_FIRESTORE_EMULATOR=true`: Uses local Firestore emulator for data storage

This setup allows you to test with actual Google authentication while keeping your data local during development.

### Firebase Security Rules

The project includes Firestore security rules in `firestore.rules`. Deploy them with:
```bash
firebase deploy --only firestore:rules
```

### Cloud Functions

The project includes Cloud Functions for:
- Vote aggregation and real-time results
- User profile management
- Data cleanup

Deploy functions with:
```bash
cd functions
npm install
npm run build
cd ..
firebase deploy --only functions
```

## Usage

1. **View Elections**: Browse available elections without authentication
2. **Create Elections**: Login with Google to create new elections
3. **Vote**: Login and vote for your preferred candidate
4. **Real-time Results**: See live vote counts and percentages
5. **Manage Votes**: Change or cancel your vote at any time

## Demo Mode

The application gracefully falls back to mock data when Firebase is not available, making it perfect for:
- Local development without Firebase setup
- Demonstrations and presentations
- Testing UI components

## Architecture

See `architecture.md` for detailed system architecture, data models, and API design.

## Implementation Progress

See `memory.md` for current implementation status and next steps.

## License

This project is open source and available under the MIT License.
