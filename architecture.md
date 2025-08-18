# Election Voting Prediction Platform - Architecture

## Overview
本プラットフォームは、選挙における投票予定先を事前登録できるサービスです。リアルタイムの予想得票数を可視化することで、ユーザーは選挙動向を事前に把握することができます。

### Key Features
- リアルタイム得票予想の可視化
- 選挙・候補者情報の動的登録（一般ユーザー対応）
- Google OAuth による安全な認証
- 重複投票防止機能
- 投票予定の自由な変更・取り消し

## Tech Stack

### Frontend
- **Framework**: React 18 with TypeScript
- **Routing**: React Router v6
- **Styling**: Tailwind CSS
- **State Management**: React Context + useReducer
- **HTTP Client**: Axios
- **Build Tool**: Vite

### Backend
- **Runtime**: Node.js with Express
- **Language**: TypeScript
- **Authentication**: Google OAuth 2.0
- **Validation**: Zod
- **Security**: helmet, cors, rate-limiting

### Database
- **Primary**: Firestore
- **Authentication**: Firebase Auth
- **Security**: Firestore Security Rules

### Infrastructure

#### Recommended Configuration (Free Tier)
- **Frontend**: Vercel (Free tier - 100GB bandwidth/month, 100 builds/month)
- **Backend**: Firebase Functions (Free tier - 2M invocations/month, 400,000 GB-seconds)
- **Database**: Firestore (Free tier - 1GB storage, 50,000 reads/day, 20,000 writes/day)
- **Authentication**: Firebase Auth (Free tier - unlimited users)

**Advantages:**
- No cold start issues (much faster than Render)
- Auto-scaling based on demand
- Built-in real-time updates
- Integrated Google OAuth
- Better reliability and uptime

## Firestore Data Model

```typescript
// Collections structure
/elections/{electionId}
{
  title: string
  description: string
  startDate: Timestamp
  endDate: Timestamp
  createdBy: string // raw user ID
  createdAt: Timestamp
  updatedAt: Timestamp
}

/elections/{electionId}/candidates/{candidateId}
{
  name: string
  description: string
  imageUrl: string
  createdAt: Timestamp
}

/users/{userId}
{
  email: string
  name: string
  avatarUrl: string
  createdAt: Timestamp
  lastLogin: Timestamp
}

/votes/{userId}
{
  elections: {
    [electionId]: {
      candidateId: string
      createdAt: Timestamp
      updatedAt: Timestamp
    }
  }
}

// Real-time aggregation collection
/electionResults/{electionId}
{
  totalVotes: number
  candidates: {
    [candidateId]: {
      count: number
      percentage: number
    }
  }
  lastUpdated: Timestamp
}
```

### Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Elections - readable by all, writable by authenticated users
    match /elections/{electionId} {
      allow read: if true;
      allow create: if request.auth != null && 
        request.auth.uid != null &&
        resource == null;
      allow update, delete: if request.auth != null && 
        resource.data.createdBy == request.auth.uid;
      
      // Candidates subcollection
      match /candidates/{candidateId} {
        allow read: if true;
        allow create: if request.auth != null;
        allow update, delete: if request.auth != null && 
          get(/databases/$(database)/documents/elections/$(electionId)).data.createdBy == request.auth.uid;
      }
    }
    
    // Users - only readable/writable by the user themselves
    match /users/{userId} {
      allow read, write: if request.auth != null && 
        userId == request.auth.uid;
    }
    
    // Votes - only readable/writable by the user themselves
    match /votes/{userId} {
      allow read, write: if request.auth != null && 
        userId == request.auth.uid;
    }
    
    // Election results - readable by all
    match /electionResults/{electionId} {
      allow read: if true;
      allow write: if false; // Only Cloud Functions can update
    }
  }
}
```

## API Design

### Authentication (Firebase Auth)
- `signInWithPopup(googleProvider)` - Google OAuth login (client-side)
- `signOut()` - Session termination (client-side)
- `onAuthStateChanged()` - Authentication state monitoring (client-side)

### Cloud Functions Endpoints
- `GET /api/elections` - List all active elections
- `POST /api/elections` - Create new election (authenticated)
- `GET /api/elections/:id` - Get election details with real-time results
- `PUT /api/elections/:id` - Update election (creator only)
- `DELETE /api/elections/:id` - Delete election (creator only)

### Real-time Listeners (Client-side)
- `onSnapshot(collection('elections'))` - Real-time election list
- `onSnapshot(doc('electionResults/{id}'))` - Real-time vote counts
- `onSnapshot(doc('votes/{userId}'))` - User's current votes

### Vote Management
- Cloud Function triggered on vote document changes
- Automatically updates aggregated results
- Maintains referential integrity

## Security Considerations

- **Authentication**: Firebase Auth with Google OAuth
- **Authorization**: Firestore Security Rules
- **Data Validation**: Cloud Functions with Zod schemas
- **Rate Limiting**: Firebase App Check + Cloud Functions
- **Privacy**: Direct user ID storage for simplified management
- **GDPR Compliance**: Built-in data deletion capabilities
