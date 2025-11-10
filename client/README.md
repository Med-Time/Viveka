# Viveka - Personalized Learning Platform

A production-ready React + TypeScript web application that provides personalized learning experiences through AI-powered assessments and adaptive content.

## 🚀 Features

- **Polished Marketing Homepage** - Hero section, features, how it works, testimonials, and CTA
- **Authentication System** - Email/password login and signup with form validation
- **Learner Onboarding** - Collect learner details, goals, and course preferences
- **Adaptive Assessment** - MCQ, open-ended, and fill-in-the-blank questions with instant evaluation
- **Persona Generation** - AI-generated learning profile based on assessment results
- **Custom Lesson Plans** - Personalized curriculum with chapter objectives and time estimates
- **Rich Content Reader** - Markdown-based content with syntax highlighting, navigation, and font controls
- **Protected Routes** - Secure access to authenticated features
- **Loading & Error States** - Comprehensive UX with skeletons, spinners, and error handling

## 🛠 Tech Stack

- **Framework**: React 18 + TypeScript + Vite
- **Routing**: React Router v6
- **State Management**: React Query (TanStack Query) for server state
- **HTTP Client**: Axios with interceptors
- **UI Components**: shadcn/ui + Tailwind CSS
- **Icons**: lucide-react
- **Forms**: react-hook-form + zod validation
- **Markdown**: react-markdown + rehype/remark plugins

## 📦 Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Update .env with your backend URL
VITE_API_BASE_URL=http://localhost:8000
```

## 🏃 Running the Application

```bash
# Development mode
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 🔌 Backend API Integration

The application expects the following backend endpoints:

### Authentication
- `POST /auth/signup` - Create new user account
- `POST /auth/login` - Authenticate existing user

### Assessment
- `POST /interview/start` - Initialize assessment session
- `POST /interview/answer` - Submit answer and get evaluation

### Persona & Planning
- `GET /persona/{study_id}` - Retrieve learner persona report
- `GET /lesson-plan/generate/{study_id}` - Trigger lesson plan generation
- `GET /lesson-plan/{study_id}` - Fetch generated lesson plan

### Content
- `GET /content/generate/{study_id}/{chapter_idx}` - Generate chapter content
- `GET /content/{study_id}/{chapter_idx}` - Retrieve chapter content

### Response Types

See `src/types/api.ts` for complete TypeScript interfaces of request/response shapes.

## 📁 Project Structure

```
src/
├── api/                    # API client configuration
│   ├── axiosClient.ts      # Axios setup with interceptors
│   └── queryKeys.ts        # React Query key management
├── components/
│   ├── Layout/             # App header, protected routes
│   ├── Plan/               # Lesson plan components
│   ├── Question/           # Question type components (MCQ, Open, Fill)
│   ├── ui/                 # shadcn UI primitives
│   └── MarkdownRenderer.tsx
├── features/               # Feature-based modules
│   ├── auth/               # Login/signup pages and API
│   ├── content/            # Content reader
│   ├── interview/          # Assessment flow
│   ├── lessonPlan/         # Lesson plan generation
│   ├── onboarding/         # Learner onboarding
│   └── persona/            # Persona report display
├── hooks/
│   └── useAuth.ts          # Authentication hook
├── pages/
│   ├── HomePage.tsx        # Marketing landing page
│   ├── DashboardPage.tsx   # User dashboard
│   └── NotFound.tsx        # 404 page
├── types/
│   └── api.ts              # TypeScript API types
└── App.tsx                 # Main routing configuration
```

## 🎨 Design System

The application uses a custom design system defined in:
- `src/index.css` - CSS variables for colors, gradients, animations
- `tailwind.config.ts` - Tailwind configuration with semantic tokens

### Color Palette
- **Primary**: Deep ocean blue (#2563EB) - Trust, intelligence
- **Secondary**: Vibrant cyan (#06B6D4) - Energy, progress
- **Accent**: Teal (#14B8A6) - Growth, success

### Key Design Principles
- Clean, spacious layouts with generous padding
- Smooth animations and transitions
- Accessible color contrast ratios
- Responsive design for all screen sizes
- Typography-focused content presentation

## 🔐 Authentication Flow

1. User signs up with email, password, and optional learner details
2. JWT token stored in localStorage
3. Token automatically attached to requests via Axios interceptor
4. Protected routes redirect unauthenticated users to /auth
5. 401 responses trigger automatic logout and redirect

## 🎯 User Journey

1. **Homepage** → View features and benefits, click "Get Started"
2. **Auth** → Login or signup with email/password
3. **Dashboard** → Access to all features and progress
4. **Onboarding** → Share learning goals and preferences
5. **Assessment** → Complete adaptive questions with instant feedback
6. **Persona** → View personalized learning profile
7. **Lesson Plan** → Generate custom curriculum
8. **Content** → Read chapters with rich Markdown content

## 🧪 Development Tips

- Use React Query DevTools for debugging server state
- Check browser console for API errors
- Verify `.env` file has correct backend URL
- Use TypeScript strict mode for type safety
- Follow component structure: smaller, focused files

## 📝 Environment Variables

```bash
# Backend API base URL
VITE_API_BASE_URL=http://localhost:8000

# Optional: Enable MSW mocks (not implemented)
VITE_USE_MSW=false
```

## 🚨 Error Handling

- **Network errors**: Toast notifications with retry suggestions
- **401 Unauthorized**: Auto-logout and redirect to login
- **Form validation**: Inline error messages with zod schemas
- **Loading states**: Spinners and skeleton placeholders
- **Empty states**: Friendly messages when no data available

## 🎓 Assessment Types

### Multiple Choice (MCQ)
- Radio button selection
- Single answer submission
- Instant correctness feedback

### Open-Ended
- Textarea input with word count
- Flexible length responses
- Detailed evaluation feedback

### Fill-in-the-Blanks
- Multiple input fields
- All blanks must be filled
- Structured answer validation

## 📱 Responsive Design

- Mobile-first approach
- Breakpoints: sm (640px), md (768px), lg (1024px)
- Touch-friendly targets (min 44×44px)
- Collapsible navigation on mobile

## 🔒 Security Features

- Input validation with zod schemas
- Password minimum length enforcement
- XSS protection via React's default escaping
- Secure token storage in localStorage
- HTTPS recommended for production

## 📊 Performance Optimizations

- Code splitting with React Router
- React Query caching for API responses
- Lazy loading for heavy components
- Optimized Tailwind CSS bundle
- Tree-shaking with Vite

## 🐛 Known Limitations

- No actual backend implementation (requires separate API)
- No MSW mock layer (can be added if needed)
- localStorage auth tokens (consider httpOnly cookies for production)
- No refresh token mechanism
- No offline support

## 📖 Additional Documentation

- [shadcn/ui Components](https://ui.shadcn.com/)
- [React Query Docs](https://tanstack.com/query/latest)
- [React Router Docs](https://reactrouter.com/)
- [Tailwind CSS Docs](https://tailwindcss.com/)

## 🤝 Contributing

1. Follow the existing code structure
2. Use TypeScript strict mode
3. Add proper error handling
4. Include loading states
5. Write semantic HTML
6. Follow accessibility guidelines

## 📄 License

This project is provided as-is for educational and development purposes.

---

Built with ❤️ using React, TypeScript, and modern web technologies.
