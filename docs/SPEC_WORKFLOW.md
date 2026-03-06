# Spec-Driven Development Workflow

Adapted from Kiro's spec methodology for the Data Platform.

## Overview

Every feature/project follows a structured 3-phase workflow:

```
Requirements → Design → Tasks → Execute
     ↑            ↑         ↑
   Review       Review    Review
   & Approve    & Approve & Approve
```

Each phase requires **explicit user approval** before proceeding.

## Phase 1: Requirements

Gather and formalize requirements using EARS format.

Each requirement includes:
- **User Story**: As a [role], I want [feature], so that [benefit]
- **Acceptance Criteria** (EARS format):
  - WHEN [event] THEN [system] SHALL [response]
  - IF [precondition] THEN [system] SHALL [response]

## Phase 2: Design

Create a comprehensive design document:
- Overview
- Architecture
- Components & Interfaces
- Data Models
- Error Handling
- Testing Strategy

## Phase 3: Tasks

Break design into actionable implementation tasks:
- Each task has a clear coding objective
- References specific requirements
- Builds incrementally on previous tasks
- Follows test-driven development

## Execution

- One task at a time
- User reviews after each task
- No automatic progression

## Mode Classification

User input is classified into:
- **Do**: Execute an action
- **Spec**: Work with specifications
- **Query**: Ask a question

The CLI (`Ctrl+K`) routes commands based on classification.
