The following is comprehensive technical documentation about the Daemo Engine:
# Comprehensive Daemo Engine Documentation

> **Purpose**: This document provides a complete technical reference for the Daemo Engine ecosystem, including the Rust backend, Node SDK, frontend, and reference implementations. It's designed to help AI coding agents understand and improve the Daemo platform.

## Table of Contents

1. [Executive Overview](#1-executive-overview)
2. [Architecture Overview](#2-architecture-overview)
3. [Native Mode Deep Dive](#3-native-mode-deep-dive)
4. [Function Schemas & Tool System](#4-function-schemas--tool-system)
5. [Daemo Node SDK](#5-daemo-node-sdk)
6. [LLM Communication Layer](#6-llm-communication-layer)
7. [Memory Management](#7-memory-management)
8. [Frontend Query Playground](#8-frontend-query-playground)
9. [Complete Data Flow](#9-complete-data-flow)
10. [Reference Implementation](#10-reference-implementation)
11. [Key File References](#11-key-file-references)
12. [Improvement Guidelines](#12-improvement-guidelines)

---

## 1. Executive Overview

### What is Daemo?

**Daemo Engine** is a sophisticated multi-phase AI agent system that enables developers to create production-ready AI agents with native LLM tool-calling capabilities. It bridges custom business logic with multiple LLM providers (Claude, OpenAI, Gemini) through a standardized, type-safe interface.

### Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Daemo Ecosystem                           │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────┐│
│  │ Daemo Frontend  │  │  Developer's     │  │  Daemo Node ││
│  │  (Next.js/React)│  │  Agent App       │  │  SDK        ││
│  │  - Query UI     │  │  - Custom Logic  │  │  - Builder  ││
│  │  - JSX Render   │  │  - Tools/Funcs   │  │  - Decorators││
│  │  - Streaming    │  │  - Express API   │  │  - gRPC     ││
│  └────────┬────────┘  └────────┬─────────┘  └──────┬──────┘│
│           │                    │                    │        │
│           └────────────────────┼────────────────────┘        │
│                                │                             │
│                    ┌───────────▼──────────┐                  │
│                    │  Daemo Engine (Rust) │                  │
│                    │  - Native Mode       │                  │
│                    │  - Function Router   │                  │
│                    │  - Memory Manager    │                  │
│                    │  - LLM Abstraction   │                  │
│                    │  - Truncation        │                  │
│                    └───────────┬──────────┘                  │
│                                │                             │
│              ┌─────────────────┼─────────────────┐           │
│              │                 │                 │           │
│         ┌────▼────┐      ┌─────▼─────┐    ┌─────▼─────┐    │
│         │ Claude  │      │  OpenAI   │    │  Gemini   │    │
│         │   API   │      │Compatible │    │    API    │    │
│         └─────────┘      └───────────┘    └───────────┘    │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Key Features

1. **Native LLM Tool Calling**: Uses Anthropic's `tool_use` and OpenAI's `function_calling` standards
2. **Multi-Provider Support**: Single codebase works with Claude, OpenAI, Gemini, Fireworks, SambaNova, Cerebras
3. **Type Safety**: Zod-based schema validation for all inputs and outputs
4. **Memory Management**: Thread-based conversation persistence with named data storage
5. **Smart Truncation**: Automatic result limiting to prevent context overflow
6. **Loop Detection**: Prevents infinite retry patterns in agent execution
7. **Streaming Support**: Real-time SSE streaming for responsive UX
8. **Rich Responses**: JSX component rendering for data visualization

---

## 2. Architecture Overview

### 2.1 Repository Structure

```
daemo-live-bridge/
├── daemo-engine-backend/          # Rust backend (gRPC server)
│   ├── src/
│   │   ├── ai/                    # AI/LLM core
│   │   │   ├── agent/             # Agent modes (native, direct, phase1/2)
│   │   │   │   ├── native_mode.rs  # ⭐ Native tool calling
│   │   │   │   ├── direct_mode.rs
│   │   │   │   └── phase1/2.rs
│   │   │   ├── llm/               # LLM provider implementations
│   │   │   │   ├── claude.rs      # Anthropic Claude
│   │   │   │   ├── openai_compatible.rs  # OpenAI, Fireworks, etc.
│   │   │   │   └── traits.rs      # LLM abstraction
│   │   │   ├── native_tools.rs    # ⭐ Schema generation
│   │   │   ├── native_tool_router.rs  # Tool execution routing
│   │   │   ├── truncation.rs      # Result truncation
│   │   │   └── code_executor.rs   # Deno runtime for execute_code
│   │   ├── memory/                # Persistent memory
│   │   │   ├── manager.rs         # Thread lifecycle
│   │   │   ├── types.rs           # Data structures
│   │   │   └── storage.rs         # Backend-agnostic storage
│   │   ├── grpc_agent.rs          # ⭐ Main query processing
│   │   ├── grpc_gateway.rs        # Function routing
│   │   └── main.rs                # Entry point
│   └── Cargo.toml
│
├── daemo-engine/                  # Node.js SDK
│   ├── src/
│   │   ├── decorators/
│   │   │   └── daemo-function.ts  # @DaemoFunction, @DaemoSchema
│   │   ├── builder/
│   │   │   └── daemo-builder.ts   # ⭐ DaemoBuilder class
│   │   ├── connection/
│   │   │   ├── daemo-hosted-connection.ts  # Service registration
│   │   │   └── daemo-client.ts    # Query execution
│   │   ├── handler/
│   │   │   └── function-handler.ts  # Function execution
│   │   └── types/
│   │       ├── metadata.ts        # Type definitions
│   │       ├── config.ts          # Configuration
│   │       └── results.ts         # Query results
│   └── package.json
│
├── daemo-engine-frontend/         # Next.js frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── playground/
│   │   │   │   ├── BeautifulPlaygroundChat.tsx  # ⭐ Main playground
│   │   │   │   ├── PlaygroundMessage.tsx        # Message rendering
│   │   │   │   └── PlaygroundInput.tsx          # Input component
│   │   │   └── daemo-jsx-renderer.tsx  # JSX component renderer
│   │   ├── lib/
│   │   │   └── api/
│   │   │       └── agent-query.ts  # ⭐ API client for queries
│   │   └── store/
│   │       └── store.ts           # Zustand state management
│   └── package.json
│
└── daemo-sf-311-agent/            # Reference implementation
    ├── src/
    │   ├── services/
    │   │   ├── daemoService.ts    # ⭐ DaemoBuilder setup
    │   │   ├── nibrsFunctions.ts  # Custom tool implementations
    │   │   └── nibrs.schemas.ts   # Zod schemas
    │   ├── controllers/
    │   │   └── agentController.ts # HTTP request handlers
    │   └── app.ts                 # Express setup
    └── package.json
```

### 2.2 Communication Protocols

**gRPC Services** (Port 50052):
- **AgentGateway**: Bidirectional streaming for function registration and execution
- **AgentService**: Query processing and thread management

**REST API** (Port 8080):
- `/agents/{agentId}/playground/query`: Non-streaming query
- `/agents/{agentId}/playground/query-stream`: SSE streaming query
- `/agents/{agentId}/threads/*`: Thread management endpoints

### 2.3 Data Flow Pattern

```
Developer creates Agent
    ↓
[1] Define tools with @DaemoFunction decorators
    ↓
[2] Use DaemoBuilder to register services
    ↓
[3] DaemoHostedConnection establishes gRPC stream to Gateway
    ↓
[4] User sends query via Frontend or custom client
    ↓
[5] Engine processes query in Native Mode
    ↓
[6] LLM receives function schemas as native tools
    ↓
[7] LLM returns tool_use blocks
    ↓
[8] Engine routes tool calls to registered functions
    ↓
[9] Results truncated and stored in memory
    ↓
[10] LLM formats final response (text or JSX)
    ↓
[11] Frontend renders response with streaming
```

---

## 3. Native Mode Deep Dive

### 3.1 What is Native Mode?

**Location**: `/home/sgodilla/Documents/Daemo/daemo-live-bridge/daemo-engine-backend/src/ai/agent/native_mode.rs`

Native Mode is the **primary execution mode** for Daemo agents. It implements LLM tool-calling using standardized formats (Anthropic's `tool_use`, OpenAI's `function_calling`) instead of custom JSON parsing.

**Key Advantages**:
- Direct LLM tool support (no custom prompting for tool calling)
- Built-in tool call metadata (IDs, structured inputs)
- Provider-native error handling
- Better reliability with complex tool sequences

### 3.2 Native Mode Configuration

```rust
// native_mode.rs:224-242
pub struct NativeModeConfig {
    pub enabled: bool,              // Feature flag
    pub truncation_tokens: usize,   // Max tokens for results (~25k default)
    pub provider: String,           // "claude" or "openai_compatible"
}
```

**Environment Variables**:
```bash
DAEMO_NATIVE_TOOLS_MODE=true        # Enable native mode
DAEMO_TRUNCATION_TOKENS=25000       # Token limit for function results
```

### 3.3 Native Mode Processing Loop

**Main Function**: `process_native_query()` (native_mode.rs:249-718)

```rust
const MAX_NATIVE_STEPS: usize = 20;      // Maximum iterations
const WARN_STEPS_THRESHOLD: usize = 15;  // Warning threshold

async fn process_native_query(
    agent_ctx: &AgentContext,
    query: String,
    llm_provider: Arc<dyn LlmProvider>,
    thread_id: String,
) -> DaemoResult<NativeQueryResult> {
    // Step 1: Load conversation history (last 20 messages)
    let mut conversation_history = load_conversation_history(...);

    // Step 2: Generate function schemas as native tools
    let native_tools = generate_native_tool_schemas(&session, &role);

    // Step 3: Build system prompt with function index
    let system_prompt = build_system_prompt(...);

    // Step 4: Initialize tool call tracker (loop detection)
    let mut tracker = ToolCallTracker::new();

    // Step 5: Main processing loop
    for step in 0..MAX_NATIVE_STEPS {
        // Call LLM with tools
        let llm_response = llm_provider.generate(LlmRequest {
            system_prompt: system_prompt.clone(),
            messages: conversation_history.clone(),
            tools: Some(native_tools_json.clone()),
            ...
        }).await?;

        // Add assistant response to history
        conversation_history.push(llm_message);

        // Check stop reason
        if llm_response.stop_reason == "end_turn" {
            // No more tool calls - return final response
            return Ok(NativeQueryResult {
                response: llm_response.content,
                ...
            });
        }

        // Process tool calls
        if !llm_response.tool_use_blocks.is_empty() {
            let mut tool_results = Vec::new();

            for tool_call in llm_response.tool_use_blocks {
                // Pre-execution validation (loop detection)
                let check_result = tracker.check_call(
                    &tool_call.name,
                    &tool_call.input,
                    None,
                )?;

                if check_result.blocked {
                    // Add error result
                    tool_results.push(NativeToolResult {
                        tool_call_id: tool_call.id.clone(),
                        success: false,
                        error: Some(check_result.message),
                        ...
                    });
                    continue;
                }

                // Execute tool
                let result = execute_native_tool(&tool_call, &exec_ctx).await;

                // Update tracker with result
                tracker.record_result(
                    &tool_call.name,
                    &tool_call.input,
                    &result,
                );

                tool_results.push(result);
            }

            // Format results for LLM
            let formatted_results = format_tool_results_for_history(
                tool_results,
                provider_name,
            );

            conversation_history.extend(formatted_results);

            // Add UX hints if problematic patterns detected
            if let Some(hint) = tracker.get_ux_hint() {
                conversation_history.push(hint);
            }

            // Warning at step threshold
            if step >= WARN_STEPS_THRESHOLD {
                conversation_history.push(warning_message);
            }
        }
    }

    // Max steps reached - graceful fallback
    let final_response = llm_provider.generate(LlmRequest {
        system_prompt,
        messages: conversation_history,
        tools: None,  // No tools to force response
        ...
    }).await?;

    Ok(NativeQueryResult {
        response: final_response.content,
        ...
    })
}
```

### 3.4 Loop Detection System

**Purpose**: Prevent infinite retry patterns where the LLM repeatedly calls the same function expecting different results.

**Implementation**: `ToolCallTracker` (native_mode.rs:63-221)

```rust
pub struct ToolCallTracker {
    // History of calls: function_name -> (params_json, result_json)
    call_history: HashMap<String, Vec<(String, Option<String>)>>,
}

impl ToolCallTracker {
    // Three blocking conditions:

    // 1. Identical Parameters Loop (lines 106-123)
    // If same function called 3+ times with identical params → BLOCKED
    fn check_identical_params_loop(&self, name: &str, params: &Value) -> Option<String> {
        let history = self.call_history.get(name)?;
        let identical_count = history.iter()
            .filter(|(p, _)| p == &serde_json::to_string(params).unwrap())
            .count();

        if identical_count >= 3 {
            Some(format!(
                "Function '{}' has been called 3+ times with identical parameters. \
                This suggests the approach isn't working. Try:\n\
                1. Different parameters or criteria\n\
                2. Using execute_code to process existing data\n\
                3. A completely different approach",
                name
            ))
        } else {
            None
        }
    }

    // 2. Empty Results Loop (lines 125-137)
    // If function returns empty 2+ times with similar params → BLOCKED
    fn check_empty_results_loop(&self, name: &str, params: &Value) -> Option<String> {
        let history = self.call_history.get(name)?;
        let empty_count = history.iter()
            .filter(|(_, r)| {
                r.as_ref()
                    .map(|s| s.contains("\"results\":[]") || s.contains("\"count\":0"))
                    .unwrap_or(false)
            })
            .count();

        if empty_count >= 2 {
            Some(format!(
                "Function '{}' has returned empty results multiple times. \
                The data you're looking for likely doesn't exist with these criteria.",
                name
            ))
        } else {
            None
        }
    }

    // 3. UX Hints (lines 140-149)
    // After 2 similar calls: Suggest using execute_code
    fn get_ux_hint(&self) -> Option<String> {
        for (name, history) in &self.call_history {
            if history.len() >= 2 {
                return Some(format!(
                    "You've called '{}' multiple times. Consider using execute_code \
                    to process the data you already have instead of fetching more.",
                    name
                ));
            }
        }
        None
    }
}
```

**Key Insights**:
- Prevents wasted API calls and token usage
- Guides LLM toward alternative approaches
- Graceful degradation instead of hard failures

### 3.5 Built-in Tools

**Location**: native_tools.rs:288-358

Every native mode session includes two built-in tools:

#### 3.5.1 execute_code

```rust
{
    "name": "execute_code",
    "description": "Execute JavaScript code in a Deno runtime. You can access \
                    previously stored results as variables (e.g., searchAgencies_result). \
                    This is useful for processing, transforming, or analyzing data \
                    without making additional function calls.",
    "input_schema": {
        "type": "object",
        "properties": {
            "code": {
                "type": "string",
                "description": "JavaScript code to execute. Can reference stored variables."
            },
            "result_name": {
                "type": "string",
                "description": "Variable name to store the result (e.g., 'processed_data')"
            },
            "result_description": {
                "type": "string",
                "description": "Human-readable description of what the result contains"
            }
        },
        "required": ["code", "result_name", "result_description"]
    }
}
```

**Example Usage**:
```javascript
// Agent receives large dataset from searchAgencies
// Instead of calling another function, use execute_code:
{
    code: "searchAgencies_result.results.filter(r => r.population > 100000)",
    result_name: "large_agencies",
    result_description: "Agencies with population over 100k"
}
```

**Implementation**: Deno runtime with injected variables from memory

#### 3.5.2 get_function_schema

```rust
{
    "name": "get_function_schema",
    "description": "Get the detailed schema for a specific function, including \
                    parameter types, return type, and TypeScript signatures. \
                    Use this when you need to understand the exact structure of \
                    a function's inputs or outputs.",
    "input_schema": {
        "type": "object",
        "properties": {
            "function_name": {
                "type": "string",
                "description": "Name of the function to get schema for"
            }
        },
        "required": ["function_name"]
    }
}
```

**Purpose**: Helps LLM understand complex function signatures on-demand

### 3.6 System Prompt Structure

**Location**: native_mode.rs:765-867

The system prompt includes:

1. **Function Index**: List of all available functions with descriptions
2. **Variable Naming**: Convention for stored results (e.g., `functionName_result`)
3. **Dot Notation**: Rules for accessing nested data
4. **Memory Summary**: Available variables from previous turns
5. **Custom Prompt**: User-provided additional instructions

```rust
fn build_system_prompt(
    session: &MergedAgentSession,
    function_registry: &HashMap<String, FunctionMeta>,
    memory_summary: &str,
    custom_prompt: &Option<String>,
) -> String {
    let mut prompt = String::new();

    // Function index
    prompt.push_str("# Available Functions\n\n");
    for (name, meta) in function_registry {
        prompt.push_str(&format!(
            "- **{}**: {}\n  Returns: {}\n",
            name,
            meta.description,
            summarize_return_schema(&meta.return_type)
        ));
    }

    // Variable naming convention
    prompt.push_str("\n# Data Storage\n");
    prompt.push_str("When you call a function, the result is stored as `{functionName}_result`.\n");
    prompt.push_str("Use execute_code to access: searchAgencies_result.results[0].name\n\n");

    // Memory summary
    if !memory_summary.is_empty() {
        prompt.push_str("# Available Variables\n");
        prompt.push_str(memory_summary);
    }

    // Custom prompt
    if let Some(custom) = custom_prompt {
        prompt.push_str("\n# Additional Instructions\n");
        prompt.push_str(custom);
    }

    prompt
}
```

---

## 4. Function Schemas & Tool System

### 4.1 Schema Generation Pipeline

**Location**: `/home/sgodilla/Documents/Daemo/daemo-live-bridge/daemo-engine-backend/src/ai/native_tools.rs`

```rust
// High-level flow (lines 26-72)
pub fn generate_native_tool_schemas(
    session: &MergedAgentSession,
    role: &Option<String>,
) -> Vec<NativeToolSchema> {
    let mut schemas = Vec::new();

    // Add built-in tools
    schemas.push(get_execute_code_schema());
    schemas.push(get_function_schema_tool());

    // Add user-defined functions
    for service in &session.services {
        for function in &service.functions {
            // Role-based filtering
            if let Some(role_filter) = role {
                if !function.roles.is_empty() && !function.roles.contains(role_filter) {
                    continue;
                }
            }

            // Convert to native schema
            let schema = NativeToolSchema {
                name: function.name.clone(),
                description: enrich_description(function),
                parameters: convert_parameters(&function.parameters),
                return_type: summarize_return_schema(&function.return_type),
            };

            schemas.push(schema);
        }
    }

    schemas
}

// Enriches description with return type info (lines 74-121)
fn enrich_description(func: &FunctionSchema) -> String {
    let mut desc = func.description.clone();

    // Add return type summary
    let return_summary = summarize_return_schema(&func.return_type);
    desc.push_str(&format!("\n\nReturns: {}", return_summary));

    // Add examples if available
    if !func.examples.is_empty() {
        desc.push_str("\n\nExamples:\n");
        for example in &func.examples {
            desc.push_str(&format!("- {}\n", example));
        }
    }

    desc
}
```

### 4.2 Return Schema Summarization

**Purpose**: Convert JSON Schema to human-readable format for LLM

```rust
// native_tools.rs:74-121
fn summarize_return_schema(schema: &Value) -> String {
    // Object: { field: type, ... }
    if schema["type"] == "object" {
        let props = schema["properties"].as_object()?;
        let summary = props.iter()
            .map(|(k, v)| format!("{}: {}", k, get_type_name(v)))
            .collect::<Vec<_>>()
            .join(", ");
        return format!("{{ {} }}", summary);
    }

    // Array: Array of <element_type>
    if schema["type"] == "array" {
        let items = &schema["items"];
        return format!("Array of {}", summarize_return_schema(items));
    }

    // Primitive: string, number, boolean
    schema["type"].as_str().unwrap_or("any").to_string()
}
```

**Examples**:
- `{ agencies: array, total_count: number, state_abbr: string }`
- `Array of objects with: ori (string), agency_name (string), population (number)`
- `{ success: boolean, data: object }`

### 4.3 Provider-Specific Formatting

#### Anthropic Format

```rust
// native_tools.rs:194-205
fn to_anthropic_format(schema: &NativeToolSchema) -> Value {
    json!({
        "name": schema.name,
        "description": schema.description,
        "input_schema": {
            "type": "object",
            "properties": schema.parameters,
            "required": get_required_params(&schema.parameters)
        }
    })
}
```

**Example Output**:
```json
{
  "name": "searchAgencies",
  "description": "Search for law enforcement agencies by criteria...\n\nReturns: { agencies: array, total_count: number }",
  "input_schema": {
    "type": "object",
    "properties": {
      "state_abbr": {
        "type": "string",
        "description": "Two-letter state abbreviation (e.g., 'CA')"
      },
      "limit": {
        "type": "number",
        "description": "Maximum results to return (default: 100)"
      }
    },
    "required": ["state_abbr"]
  }
}
```

#### OpenAI Format

```rust
// native_tools.rs:220-234
fn to_openai_format(schema: &NativeToolSchema) -> Value {
    json!({
        "type": "function",
        "function": {
            "name": schema.name,
            "description": schema.description,
            "parameters": {
                "type": "object",
                "properties": schema.parameters,
                "required": get_required_params(&schema.parameters)
            }
        }
    })
}
```

**Example Output**:
```json
{
  "type": "function",
  "function": {
    "name": "searchAgencies",
    "description": "Search for law enforcement agencies...",
    "parameters": {
      "type": "object",
      "properties": { /* same as Anthropic */ },
      "required": ["state_abbr"]
    }
  }
}
```

### 4.4 Function Registry

**Location**: native_tools.rs:149-169

Maps function names to metadata for routing:

```rust
pub struct FunctionMeta {
    pub name: String,
    pub service_name: String,
    pub parameters: Vec<ParameterSchema>,
    pub return_type: Value,
}

pub fn build_function_registry(
    session: &MergedAgentSession,
) -> HashMap<String, FunctionMeta> {
    let mut registry = HashMap::new();

    for service in &session.services {
        for function in &service.functions {
            registry.insert(
                function.name.clone(),
                FunctionMeta {
                    name: function.name.clone(),
                    service_name: service.service_name.clone(),
                    parameters: function.parameters.clone(),
                    return_type: function.return_type.clone(),
                },
            );
        }
    }

    registry
}
```

**Usage**: Router looks up function metadata to determine how to execute it (gRPC call vs built-in tool)

### 4.5 Tool Execution Routing

**Location**: `/home/sgodilla/Documents/Daemo/daemo-live-bridge/daemo-engine-backend/src/ai/native_tool_router.rs`

```rust
// Lines 48-143
pub async fn execute_native_tool(
    tool_call: &NativeToolCall,
    ctx: &ToolExecutionContext,
) -> NativeToolResult {
    match tool_call.name.as_str() {
        // Built-in: execute_code
        "execute_code" => {
            let code = tool_call.input["code"].as_str()?;
            let result_name = tool_call.input["result_name"].as_str()?;

            // Get stored variables from memory
            let variables = ctx.memory_manager
                .get_named_data(&ctx.thread_id)
                .await?;

            // Execute in Deno runtime
            let result = execute_deno_code(code, &variables).await?;

            // Check for JavaScript errors
            if result.get("_error").is_some() {
                return NativeToolResult {
                    tool_call_id: tool_call.id.clone(),
                    success: false,
                    error: Some(result["_error"].to_string()),
                    ...
                };
            }

            // Store result in memory
            ctx.memory_manager.store_data(
                &ctx.thread_id,
                result_name,
                &result,
                &tool_call.input["result_description"],
            ).await?;

            // Truncate for LLM response
            let truncated = truncate_result(
                &result,
                result_name,
                ctx.truncation_tokens,
            );

            NativeToolResult {
                tool_call_id: tool_call.id.clone(),
                success: true,
                result: Some(truncated.truncated_data),
                storage_var: result_name.to_string(),
                was_truncated: truncated.was_truncated,
                ...
            }
        },

        // Built-in: get_function_schema
        "get_function_schema" => {
            let function_name = tool_call.input["function_name"].as_str()?;
            let meta = ctx.session.function_registry.get(function_name)?;

            NativeToolResult {
                tool_call_id: tool_call.id.clone(),
                success: true,
                result: Some(json!({
                    "name": meta.name,
                    "parameters": meta.parameters,
                    "return_type": meta.return_type,
                })),
                ...
            }
        },

        // User-defined function: Route via Redis/gRPC
        _ => {
            let meta = ctx.session.function_registry.get(&tool_call.name)?;

            // Publish function call to Redis
            let call_id = publish_function_call(
                &ctx.redis_client,
                &meta.service_name,
                &tool_call.name,
                &tool_call.input,
            ).await?;

            // Wait for result (with timeout)
            let result = wait_for_result(
                &ctx.response_waiters,
                call_id,
                Duration::from_secs(30),
            ).await?;

            // Truncate result
            let storage_var = format!("{}_result", tool_call.name);
            let truncated = truncate_result(
                &result,
                &storage_var,
                ctx.truncation_tokens,
            );

            // Store in memory
            ctx.memory_manager.store_data(
                &ctx.thread_id,
                &storage_var,
                &result,
                &format!("Result from {}", tool_call.name),
            ).await?;

            NativeToolResult {
                tool_call_id: tool_call.id.clone(),
                success: true,
                result: Some(truncated.truncated_data),
                storage_var,
                was_truncated: truncated.was_truncated,
                ...
            }
        }
    }
}
```

---

## 5. Daemo Node SDK

### 5.1 SDK Architecture

**Location**: `/home/sgodilla/Documents/Daemo/daemo-live-bridge/daemo-engine/src`

The Node SDK provides a decorator-based API for defining AI agent tools:

```typescript
// Main exports (src/index.ts)
export { DaemoBuilder }                    // Builder for agent configuration
export { DaemoHostedConnection }           // gRPC connection to engine
export { DaemoClient }                     // Client for sending queries
export { DaemoFunction, DaemoSchema }      // Decorators
export { getGlobalFunctionHandler }        // Function executor
```

### 5.2 Creating an Agent - Complete Example

```typescript
// Step 1: Enable decorators in tsconfig.json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}

// Step 2: Import required modules
import "reflect-metadata";
import { DaemoBuilder, DaemoHostedConnection, DaemoFunction } from "daemo-engine";
import { z } from "zod";

// Step 3: Define data models (optional)
@DaemoSchema({
  description: "A product in the catalog",
  properties: {
    id: { type: "string", description: "Product ID" },
    name: { type: "string", description: "Product name" },
    price: { type: "number", description: "Price in USD" },
  }
})
class Product {
  id: string = "";
  name: string = "";
  price: number = 0;
}

// Step 4: Define service with tools
class ProductService {
  private products: Product[] = [
    { id: "1", name: "Laptop", price: 999 },
    { id: "2", name: "Mouse", price: 25 },
  ];

  @DaemoFunction({
    description: "Search for products by name",
    inputSchema: z.object({
      searchTerm: z.string().describe("Product name to search for"),
      limit: z.number().optional().default(10).describe("Max results"),
    }),
    outputSchema: z.array(z.object({
      id: z.string(),
      name: z.string(),
      price: z.number(),
    })),
    tags: ["product", "search"],
    category: "Product Management",
  })
  async searchProducts(input: { searchTerm: string; limit?: number }): Promise<Product[]> {
    return this.products
      .filter(p => p.name.toLowerCase().includes(input.searchTerm.toLowerCase()))
      .slice(0, input.limit || 10);
  }

  @DaemoFunction({
    description: "Get product by ID",
    inputSchema: z.object({
      productId: z.string().describe("The product ID"),
    }),
    outputSchema: z.object({
      id: z.string(),
      name: z.string(),
      price: z.number(),
    }).nullable(),
  })
  async getProduct(input: { productId: string }): Promise<Product | null> {
    return this.products.find(p => p.id === input.productId) || null;
  }
}

// Step 5: Build and register
async function main() {
  const sessionData = new DaemoBuilder()
    .withServiceName("product_service")
    .withSystemPrompt("You are a helpful shopping assistant.")
    .registerService(new ProductService())
    .build();

  // Step 6: Connect to Daemo Gateway
  const connection = new DaemoHostedConnection(
    {
      daemoGatewayUrl: process.env.DAEMO_GATEWAY_URL || "localhost:50052",
      agentApiKey: process.env.DAEMO_AGENT_API_KEY,
    },
    sessionData
  );

  await connection.start();
  console.log("Agent connected!");
}

main().catch(console.error);
```

### 5.3 DaemoBuilder API

**Location**: `/home/sgodilla/Documents/Daemo/daemo-live-bridge/daemo-engine/src/builder/daemo-builder.ts`

```typescript
export class DaemoBuilder {
  private serviceName: string = "MyService";
  private systemPrompt: string = "";
  private functions: DaemoFunction[] = [];

  // Set service identifier
  withServiceName(serviceName: string): this {
    this.serviceName = serviceName;
    return this;
  }

  // Set LLM system prompt
  withSystemPrompt(systemPrompt: string): this {
    this.systemPrompt = systemPrompt;
    return this;
  }

  // Register service instance
  registerService<T extends object>(
    serviceInstance: T,
    namePrefix?: string
  ): this {
    // Scan for @DaemoFunction decorated methods
    const prototype = Object.getPrototypeOf(serviceInstance);
    const methodNames = Object.getOwnPropertyNames(prototype);

    for (const methodName of methodNames) {
      const metadata = Reflect.getMetadata('daemo:function', prototype, methodName);
      if (metadata) {
        const boundHandler = prototype[methodName].bind(serviceInstance);
        this.functions.push({
          name: namePrefix ? `${namePrefix}_${methodName}` : methodName,
          handler: boundHandler,
          ...metadata,
        });
      }
    }

    return this;
  }

  // Build SessionData for engine
  build(): SessionData {
    return {
      Port: 50052,
      ServiceName: this.serviceName,
      SystemPrompt: this.systemPrompt,
      Functions: this.functions.map(func => ({
        Name: func.name,
        Description: func.description,
        Examples: func.examples || [],
        Tags: func.tags || [],
        Category: func.category || "",
        Roles: func.roles || [],
        Parameters: convertZodToParameters(func.inputSchema),
        ReturnType: convertZodToJsonSchema(func.outputSchema),
        ReturnDescription: func.outputSchema.description || "",
      })),
      Definitions: {},
    };
  }
}
```

### 5.4 Schema Conversion (Zod → JSON Schema)

**Location**: `/home/sgodilla/Documents/Daemo/daemo-live-bridge/daemo-engine/src/utils/schema-generator.ts`

```typescript
import { zodToJsonSchema } from "zod-to-json-schema";

function convertZodToParameters(schema: z.ZodType<any>): Parameter[] {
  // Convert to JSON Schema
  const jsonSchema = zodToJsonSchema(schema, { target: "openApi3" });

  // Extract properties
  const properties = jsonSchema.properties || {};
  const required = jsonSchema.required || [];

  return Object.entries(properties).map(([name, prop]) => ({
    name,
    description: prop.description || "",
    schema: prop,
    required: required.includes(name),
    examples: prop.examples || [],
    defaultValue: prop.default,
  }));
}
```

**Zod Feature Support**:
- Primitives: `z.string()`, `z.number()`, `z.boolean()`
- Objects: `z.object({ ... })`
- Arrays: `z.array(z.object({ ... }))`
- Enums: `z.enum(["option1", "option2"])`
- Unions: `z.union([schema1, schema2])`
- Optionals: `z.string().optional()`, `.nullable()`
- Defaults: `z.number().default(10)`
- Validation: `.min()`, `.max()`, `.email()`, `.regex()`
- Descriptions: `.describe("Human readable text")`
- Transformations: `.transform(val => ...)`

### 5.5 Function Execution Handler

**Location**: `/home/sgodilla/Documents/Daemo/daemo-live-bridge/daemo-engine/src/handler/function-handler.ts`

```typescript
export class DaemoFunctionHandler {
  private functions: Map<string, DaemoFunction> = new Map();

  async executeFunction(
    functionName: string,
    inputJson: string
  ): Promise<{ success: boolean; resultJson: string; errorMessage: string }> {
    try {
      const func = this.functions.get(functionName);
      if (!func) {
        throw new Error(`Function '${functionName}' not found`);
      }

      let parsedArgs = JSON.parse(inputJson);

      // Smart unwrapping: Handle LLM nested argument hallucinations
      // Sometimes LLMs wrap arguments in an extra object layer
      if (typeof parsedArgs === "object" && parsedArgs !== null) {
        const schemaShape = (func.inputSchema as any).shape;
        if (schemaShape) {
          const keys = Object.keys(parsedArgs);
          if (keys.length === 1) {
            const innerValue = parsedArgs[keys[0]];
            const innerValidation = func.inputSchema.safeParse(innerValue);
            if (innerValidation.success) {
              parsedArgs = innerValue;  // Use unwrapped version
            }
          }
        }
      }

      // Validate input
      const validationResult = func.inputSchema.safeParse(parsedArgs);
      if (!validationResult.success) {
        throw new Error(`Invalid input: ${validationResult.error.message}`);
      }

      // Execute function
      const result = await func.handler(validationResult.data);

      // Serialize result
      const resultJson = result === undefined ? "null" : JSON.stringify(result);

      return { success: true, resultJson, errorMessage: "" };
    } catch (error: any) {
      return {
        success: false,
        resultJson: "",
        errorMessage: error.message || String(error),
      };
    }
  }
}
```

**Key Features**:
- Automatic input validation against Zod schema
- Smart unwrapping of nested arguments (LLM quirk handling)
- Error handling with descriptive messages
- JSON serialization of results

### 5.6 DaemoClient - Query Execution

**Location**: `/home/sgodilla/Documents/Daemo/daemo-live-bridge/daemo-engine/src/connection/daemo-client.ts`

```typescript
export class DaemoClient {
  private options: DaemoClientOptions;
  private grpcClient: any;

  // Execute single query
  async processQuery(
    query: string,
    options?: {
      threadId?: string;
      sessionId?: string;
      llmConfig?: LlmConfig;
      role?: string;
      contextJson?: string;
      directMode?: boolean;
      directModeSystemPrompt?: string;
    }
  ): Promise<QueryResult> {
    const request = {
      query,
      thread_id: options?.threadId || "",
      session_id: options?.sessionId || "",
      llm_config: options?.llmConfig,
      role: options?.role,
      context_json: options?.contextJson,
      direct_mode: options?.directMode ?? false,
      direct_mode_system_prompt: options?.directModeSystemPrompt,
    };

    return new Promise((resolve, reject) => {
      this.grpcClient.ProcessQuery(request, (error: any, response: any) => {
        if (error) {
          reject(error);
        } else {
          resolve({
            success: response.success,
            response: response.response,
            threadId: response.thread_id,
            toolInteractions: response.tool_interactions || [],
            executionTimeMs: response.execution_time_ms,
          });
        }
      });
    });
  }

  // Stream query results
  processQueryStreamed(
    query: string,
    callbacks: {
      onData: (event: QueryStreamEvent) => void;
      onError: (error: Error) => void;
      onEnd: () => void;
    },
    options?: { /* same as processQuery */ }
  ): { cancel: () => void } {
    const call = this.grpcClient.ProcessQueryStreamed(/* request */);

    call.on('data', (event: any) => {
      callbacks.onData(event);
    });

    call.on('error', (error: any) => {
      callbacks.onError(error);
    });

    call.on('end', () => {
      callbacks.onEnd();
    });

    return {
      cancel: () => call.cancel(),
    };
  }

  // Thread management
  async createThread(sessionId?: string): Promise<{ threadId: string }> { ... }
  async listThreads(sessionId?: string): Promise<{ threads: ThreadInfo[] }> { ... }
  async getThread(threadId: string): Promise<{ thread: ThreadInfo }> { ... }
  async deleteThread(threadId: string): Promise<{ success: boolean }> { ... }
}
```

---

## 6. LLM Communication Layer

### 6.1 Provider Abstraction

**Location**: `/home/sgodilla/Documents/Daemo/daemo-live-bridge/daemo-engine-backend/src/ai/llm/traits.rs`

```rust
// Unified message structure (lines 9-51)
pub struct LlmMessage {
    pub role: String,                          // "user", "assistant", "tool"
    pub content: String,                       // Text content
    pub tool_call_id: Option<String>,          // For tool result messages
    pub tool_calls: Option<Vec<NativeToolCall>>, // For assistant tool calls
}

// Unified request structure (lines 84-96)
pub struct LlmRequest {
    pub system_prompt: String,
    pub messages: Vec<LlmMessage>,
    pub max_tokens: Option<u32>,
    pub temperature: Option<f32>,
    pub model: Option<String>,
    pub tools: Option<Vec<serde_json::Value>>,  // Native tool schemas
    pub seed: Option<i64>,
}

// Unified response structure (lines 100-146)
pub struct LlmResponse {
    pub content: String,                      // Text response
    pub stop_reason: Option<String>,          // "end_turn", "tool_use", "max_tokens"
    pub tool_use_blocks: Vec<NativeToolCall>, // LLM's tool calls
    pub usage: Option<LlmUsage>,              // Token counts
}

// Provider trait (lines 157-178)
pub trait LlmProvider: Send + Sync {
    async fn generate(&self, request: LlmRequest) -> DaemoResult<LlmResponse>;
    async fn generate_stream(&self, request: LlmRequest) -> ...;
    fn name(&self) -> &str;
    async fn health_check(&self) -> DaemoResult<bool>;
}
```

### 6.2 Claude (Anthropic) Implementation

**Location**: `/home/sgodilla/Documents/Daemo/daemo-live-bridge/daemo-engine-backend/src/ai/llm/claude.rs`

```rust
// Response parsing (lines 24-72)
fn parse_anthropic_response(body: &Value) -> DaemoResult<LlmResponse> {
    let content_blocks = body["content"].as_array()?;
    let mut text_content = String::new();
    let mut tool_use_blocks = Vec::new();

    for block in content_blocks {
        match block["type"].as_str() {
            Some("text") => {
                text_content.push_str(block["text"].as_str()?);
            },
            Some("tool_use") => {
                tool_use_blocks.push(NativeToolCall {
                    id: block["id"].as_str()?.to_string(),
                    name: block["name"].as_str()?.to_string(),
                    input: block["input"].clone(),
                });
            },
            _ => {}
        }
    }

    Ok(LlmResponse {
        content: text_content,
        stop_reason: body["stop_reason"].as_str().map(String::from),
        tool_use_blocks,
        usage: extract_usage(body),
    })
}

// API call (lines 174-220)
async fn generate(&self, request: LlmRequest) -> DaemoResult<LlmResponse> {
    let mut payload = json!({
        "model": request.model.unwrap_or("claude-sonnet-4-5-20250929".to_string()),
        "max_tokens": request.max_tokens.unwrap_or(4096),
        "system": request.system_prompt,
        "messages": convert_messages_to_anthropic(&request.messages),
    });

    // Add tools if present
    if let Some(tools) = request.tools {
        payload["tools"] = json!(tools);
    }

    let response = self.http_client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", &self.api_key)
        .header("anthropic-version", "2023-06-01")
        .json(&payload)
        .send()
        .await?;

    let body = response.json::<Value>().await?;
    parse_anthropic_response(&body)
}
```

**Tool Result Format** (for sending back to Claude):
```json
{
  "type": "tool_result",
  "tool_use_id": "toolu_123abc",
  "content": "Result data here"
}
```

### 6.3 OpenAI-Compatible Implementation

**Location**: `/home/sgodilla/Documents/Daemo/daemo-live-bridge/daemo-engine-backend/src/ai/llm/openai_compatible.rs`

```rust
// Response parsing (lines 25-90)
fn parse_openai_response(body: &Value) -> DaemoResult<LlmResponse> {
    let choice = &body["choices"][0];
    let message = &choice["message"];

    let content = message["content"].as_str().unwrap_or("").to_string();
    let finish_reason = choice["finish_reason"].as_str();

    let mut tool_use_blocks = Vec::new();
    if let Some(tool_calls) = message["tool_calls"].as_array() {
        for tool_call in tool_calls {
            let function = &tool_call["function"];
            tool_use_blocks.push(NativeToolCall {
                id: tool_call["id"].as_str()?.to_string(),
                name: function["name"].as_str()?.to_string(),
                input: serde_json::from_str(function["arguments"].as_str()?)?,
            });
        }
    }

    Ok(LlmResponse {
        content,
        stop_reason: finish_reason.map(String::from),
        tool_use_blocks,
        usage: extract_usage(body),
    })
}

// Supported providers (mod.rs lines 35-95)
pub enum OpenAICompatibleProvider {
    OpenAI,      // api.openai.com
    Fireworks,   // api.fireworks.ai
    SambaNova,   // api.sambanova.ai
    Cerebras,    // api.cerebras.ai
    Custom(String),  // Custom endpoint
}

// API call (lines 134-180)
async fn generate(&self, request: LlmRequest) -> DaemoResult<LlmResponse> {
    let mut payload = json!({
        "model": request.model.unwrap_or(self.default_model.clone()),
        "messages": convert_messages_to_openai(&request.messages),
        "max_tokens": request.max_tokens,
        "temperature": request.temperature,
    });

    // Add tools
    if let Some(tools) = request.tools {
        payload["tools"] = json!(tools);
        payload["tool_choice"] = json!("auto");
    }

    let response = self.http_client
        .post(&self.endpoint_url)
        .header("Authorization", format!("Bearer {}", self.api_key))
        .json(&payload)
        .send()
        .await?;

    let body = response.json::<Value>().await?;
    parse_openai_response(&body)
}
```

**Tool Result Format** (for OpenAI):
```json
{
  "role": "tool",
  "tool_call_id": "call_123abc",
  "content": "Result data here"
}
```

### 6.4 Message Format Conversion

```rust
// Convert to Anthropic format
fn convert_messages_to_anthropic(messages: &[LlmMessage]) -> Vec<Value> {
    messages.iter().map(|msg| {
        if msg.role == "tool" {
            json!({
                "role": "user",
                "content": [{
                    "type": "tool_result",
                    "tool_use_id": msg.tool_call_id,
                    "content": msg.content,
                }]
            })
        } else if let Some(tool_calls) = &msg.tool_calls {
            json!({
                "role": "assistant",
                "content": tool_calls.iter().map(|tc| {
                    json!({
                        "type": "tool_use",
                        "id": tc.id,
                        "name": tc.name,
                        "input": tc.input,
                    })
                }).collect::<Vec<_>>()
            })
        } else {
            json!({
                "role": msg.role,
                "content": msg.content,
            })
        }
    }).collect()
}

// Convert to OpenAI format
fn convert_messages_to_openai(messages: &[LlmMessage]) -> Vec<Value> {
    messages.iter().map(|msg| {
        if msg.role == "tool" {
            json!({
                "role": "tool",
                "tool_call_id": msg.tool_call_id,
                "content": msg.content,
            })
        } else if let Some(tool_calls) = &msg.tool_calls {
            json!({
                "role": "assistant",
                "content": msg.content,
                "tool_calls": tool_calls.iter().map(|tc| {
                    json!({
                        "id": tc.id,
                        "type": "function",
                        "function": {
                            "name": tc.name,
                            "arguments": serde_json::to_string(&tc.input).unwrap(),
                        }
                    })
                }).collect::<Vec<_>>()
            })
        } else {
            json!({
                "role": msg.role,
                "content": msg.content,
            })
        }
    }).collect()
}
```

---

## 7. Memory Management

### 7.1 Thread-Based Architecture

**Location**: `/home/sgodilla/Documents/Daemo/daemo-live-bridge/daemo-engine-backend/src/memory/`

Daemo uses a **thread-based conversation model** similar to OpenAI's Assistants API.

```rust
// Thread structure (types.rs:31-41)
pub struct ConversationThread {
    pub id: String,                    // UUID or custom ID
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub messages: Vec<ThreadMessage>,  // Conversation history
    pub memory: ThreadMemory,          // Named data storage
    pub session_id: Option<String>,    // Link to session
}

// Message structure (types.rs:44-55)
pub struct ThreadMessage {
    pub id: String,
    pub timestamp: DateTime<Utc>,
    pub role: MessageRole,             // User, Assistant, System, Tool
    pub content: String,
    pub tool_calls: Vec<ToolCall>,     // Tool calls made
    pub data_references: Vec<String>,  // Data IDs referenced
    pub summary: Option<String>,       // For context compression
    pub stored_vars: Vec<String>,      // Variables created this turn
}

// Named data storage (types.rs:101-113)
pub struct NamedDataEntry {
    pub name: String,                  // Variable name (e.g., "searchAgencies_result")
    pub description: String,           // What the data contains
    pub data: Value,                   // Actual result (JSON)
    pub schema: DataTypeSchema,        // TypeScript-style schema
    pub item_count: Option<usize>,     // For arrays
    pub created_at: DateTime<Utc>,
    pub last_accessed: DateTime<Utc>, // For LRU eviction
}
```

### 7.2 Memory Manager API

**Location**: `/home/sgodilla/Documents/Daemo/daemo-live-bridge/daemo-engine-backend/src/memory/manager.rs`

```rust
pub struct MemoryManager {
    storage: Arc<dyn Storage>,         // Pluggable backend (Redis, MongoDB, etc.)
    cache: Arc<RwLock<HashMap<String, ConversationThread>>>,  // In-memory cache
    config: MemoryConfig,
}

impl MemoryManager {
    // Create new thread (lines 32-44)
    pub async fn create_thread(
        &self,
        session_id: Option<String>,
    ) -> DaemoResult<String> {
        let thread_id = Uuid::new_v4().to_string();
        let thread = ConversationThread {
            id: thread_id.clone(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
            messages: Vec::new(),
            memory: ThreadMemory::default(),
            session_id,
        };

        self.storage.save_thread(&thread).await?;
        self.cache.write().await.insert(thread_id.clone(), thread);

        Ok(thread_id)
    }

    // Add message to thread (lines 61-82)
    pub async fn add_message(
        &self,
        thread_id: &str,
        message: ThreadMessage,
    ) -> DaemoResult<()> {
        let mut thread = self.get_thread(thread_id).await?;

        thread.messages.push(message);
        thread.updated_at = Utc::now();

        // Enforce message limit
        if thread.messages.len() > self.config.max_messages {
            let remove_count = thread.messages.len() - self.config.max_messages;
            thread.messages.drain(0..remove_count);
        }

        self.storage.save_thread(&thread).await?;
        self.cache.write().await.insert(thread_id.to_string(), thread);

        Ok(())
    }

    // Store data in memory (lines 84-129)
    pub async fn store_data(
        &self,
        thread_id: &str,
        name: &str,
        data: &Value,
        description: &str,
    ) -> DaemoResult<()> {
        let mut thread = self.get_thread(thread_id).await?;

        // Infer schema from data
        let schema = infer_schema(data);

        // Detect item count for arrays
        let item_count = detect_item_count(data);

        let entry = NamedDataEntry {
            name: name.to_string(),
            description: description.to_string(),
            data: data.clone(),
            schema,
            item_count,
            created_at: Utc::now(),
            last_accessed: Utc::now(),
        };

        // Add to thread memory
        thread.memory.named_data.insert(name.to_string(), entry);

        // Enforce data limit (LRU eviction)
        if thread.memory.named_data.len() > self.config.max_data_entries {
            evict_least_recently_used(&mut thread.memory.named_data);
        }

        self.storage.save_thread(&thread).await?;
        self.cache.write().await.insert(thread_id.to_string(), thread);

        Ok(())
    }

    // Get named data (lines 131-147)
    pub async fn get_data(
        &self,
        thread_id: &str,
        name: &str,
    ) -> DaemoResult<Value> {
        let mut thread = self.get_thread(thread_id).await?;

        if let Some(entry) = thread.memory.named_data.get_mut(name) {
            entry.last_accessed = Utc::now();  // Update LRU
            self.storage.save_thread(&thread).await?;
            Ok(entry.data.clone())
        } else {
            Err(DaemoError::NotFound(format!("Data '{}' not found", name)))
        }
    }

    // Get all named data for execute_code injection
    pub async fn get_all_named_data(
        &self,
        thread_id: &str,
    ) -> DaemoResult<HashMap<String, Value>> {
        let thread = self.get_thread(thread_id).await?;
        Ok(thread.memory.named_data.iter()
            .map(|(k, v)| (k.clone(), v.data.clone()))
            .collect())
    }
}
```

### 7.3 Schema Inference

```rust
// Infer TypeScript-style schema from data
fn infer_schema(data: &Value) -> DataTypeSchema {
    match data {
        Value::Object(obj) => {
            let properties = obj.iter()
                .map(|(k, v)| (k.clone(), infer_schema(v)))
                .collect();
            DataTypeSchema::Object(properties)
        },
        Value::Array(arr) => {
            if let Some(first) = arr.first() {
                DataTypeSchema::Array(Box::new(infer_schema(first)))
            } else {
                DataTypeSchema::Array(Box::new(DataTypeSchema::Any))
            }
        },
        Value::String(_) => DataTypeSchema::String,
        Value::Number(_) => DataTypeSchema::Number,
        Value::Bool(_) => DataTypeSchema::Boolean,
        Value::Null => DataTypeSchema::Null,
    }
}
```

### 7.4 Memory Summary for LLM

```rust
// Generate summary of available variables for system prompt
fn build_memory_summary(thread: &ConversationThread) -> String {
    if thread.memory.named_data.is_empty() {
        return String::new();
    }

    let mut summary = String::from("# Available Variables\n\n");

    for (name, entry) in &thread.memory.named_data {
        summary.push_str(&format!(
            "- **{}**: {} ({})\n",
            name,
            entry.description,
            format_schema(&entry.schema)
        ));

        if let Some(count) = entry.item_count {
            summary.push_str(&format!("  Contains {} items\n", count));
        }
    }

    summary
}
```

---

## 8. Frontend Query Playground

### 8.1 Main Playground Component

**Location**: `/home/sgodilla/Documents/Daemo/daemo-live-bridge/daemo-engine-frontend/src/components/playground/BeautifulPlaygroundChat.tsx`

```typescript
export function BeautifulPlaygroundChat({ agentId }: { agentId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentThreadId, setCurrentThreadId] = useState<string | undefined>();
  const [useCustomLlm, setUseCustomLlm] = useState(false);
  const [llmConfig, setLlmConfig] = useState<LlmConfig>({ /* defaults */ });
  const [role, setRole] = useState<string>("");
  const [contextJson, setContextJson] = useState<string>("");

  const handleSend = async (query: string, files?: File[]) => {
    // Add user message
    const userMessage: Message = {
      id: generateId(),
      role: "user",
      content: query,
      timestamp: new Date(),
      files: files?.map(f => ({ url: URL.createObjectURL(f), name: f.name })),
    };
    setMessages(prev => [...prev, userMessage]);

    // Create assistant message (will be updated during streaming)
    const assistantMessage: Message = {
      id: generateId(),
      role: "assistant",
      content: "",
      timestamp: new Date(),
      toolCalls: [],
      isStreaming: true,
    };
    setMessages(prev => [...prev, assistantMessage]);

    setIsStreaming(true);

    try {
      // Build request
      const request: PlaygroundQueryRequest = {
        query,
        threadId: currentThreadId,
        llmConfig: useCustomLlm ? llmConfig : undefined,
        role: role || undefined,
        contextJson: contextJson || undefined,
      };

      // Start streaming
      const cancelStream = agentQueryApi.queryStream(
        agentId,
        request,
        {
          onData: (event: PlaygroundQueryStreamEvent) => {
            switch (event.type) {
              case "thought":
                // Internal thinking (logged but not displayed)
                console.log("LLM thinking:", event.content);
                break;

              case "toolCall":
                // Tool invocation
                setMessages(prev => {
                  const updated = [...prev];
                  const lastMsg = updated[updated.length - 1];
                  lastMsg.toolCalls = [
                    ...(lastMsg.toolCalls || []),
                    {
                      toolName: event.toolName,
                      parameters: event.parameters,
                      status: "pending",
                    }
                  ];
                  return updated;
                });
                break;

              case "toolResult":
                // Tool execution result
                setMessages(prev => {
                  const updated = [...prev];
                  const lastMsg = updated[updated.length - 1];
                  const toolCall = lastMsg.toolCalls?.find(
                    tc => tc.toolName === event.toolName
                  );
                  if (toolCall) {
                    toolCall.status = event.success ? "success" : "error";
                    toolCall.result = event.result;
                    toolCall.error = event.errorMessage;
                  }
                  return updated;
                });
                break;

              case "finalResponse":
                // Final response from LLM
                setMessages(prev => {
                  const updated = [...prev];
                  const lastMsg = updated[updated.length - 1];

                  // Handle JSX response
                  if (event.responseType === "jsx") {
                    lastMsg.jsx = event.jsx;
                    lastMsg.dataKeys = event.dataKeys || [];
                  } else {
                    // Handle text/markdown response
                    lastMsg.content = event.text || event.response || "";
                  }

                  lastMsg.isStreaming = false;
                  lastMsg.executionTimeMs = event.executionTimeMs;
                  return updated;
                });

                // Store thread ID for continuation
                setCurrentThreadId(event.threadId);
                break;

              case "error":
                // Error occurred
                setMessages(prev => {
                  const updated = [...prev];
                  const lastMsg = updated[updated.length - 1];
                  lastMsg.content = `Error: ${event.error}`;
                  lastMsg.isStreaming = false;
                  lastMsg.error = true;
                  return updated;
                });
                break;
            }
          },
          onError: (error: Error) => {
            console.error("Stream error:", error);
            setIsStreaming(false);
          },
          onEnd: () => {
            setIsStreaming(false);
          },
        }
      );

      // Store cancel function for abort
      setCancelFn(() => cancelStream);
    } catch (error) {
      console.error("Query error:", error);
      setIsStreaming(false);
    }
  };

  return (
    <div className="flex h-full">
      {/* Chat panel */}
      <div className="flex-1 flex flex-col">
        {/* Messages */}
        <ScrollArea className="flex-1">
          {messages.map(msg => (
            <PlaygroundMessage
              key={msg.id}
              message={msg}
              agentId={agentId}
              threadId={currentThreadId}
            />
          ))}
        </ScrollArea>

        {/* Input */}
        <PlaygroundInput
          onSend={handleSend}
          disabled={isStreaming}
          onStop={() => cancelFn?.()}
        />
      </div>

      {/* Config panel */}
      <div className="w-80 border-l p-4">
        <ConfigPanel
          role={role}
          setRole={setRole}
          contextJson={contextJson}
          setContextJson={setContextJson}
          useCustomLlm={useCustomLlm}
          setUseCustomLlm={setUseCustomLlm}
          llmConfig={llmConfig}
          setLlmConfig={setLlmConfig}
        />
      </div>
    </div>
  );
}
```

### 8.2 API Client Layer

**Location**: `/home/sgodilla/Documents/Daemo/daemo-live-bridge/daemo-engine-frontend/src/lib/api/agent-query.ts`

```typescript
export const agentQueryApi = {
  // Streaming query (SSE)
  queryStream(
    agentId: string,
    request: PlaygroundQueryRequest,
    callbacks: {
      onData: (event: PlaygroundQueryStreamEvent) => void;
      onError: (error: Error) => void;
      onEnd: () => void;
    }
  ): () => void {
    const abortController = new AbortController();

    const run = async () => {
      try {
        const accessToken = await getAccessToken();

        const response = await fetch(
          `/api/agents/${agentId}/playground/query-stream`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${accessToken}`,
              "Content-Type": "application/json",
              "Accept": "text/event-stream",
            },
            body: JSON.stringify(request),
            signal: abortController.signal,
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // Parse SSE stream
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Process complete SSE messages (delimited by double newline)
          let boundary = buffer.indexOf("\n\n");
          while (boundary !== -1) {
            const chunk = buffer.substring(0, boundary);
            buffer = buffer.substring(boundary + 2);

            if (chunk.startsWith("data:")) {
              const jsonStr = chunk.substring(5).trim();
              try {
                const event = JSON.parse(jsonStr);
                callbacks.onData(event);
              } catch (e) {
                console.error("Failed to parse SSE event:", e);
              }
            }

            boundary = buffer.indexOf("\n\n");
          }
        }

        callbacks.onEnd();
      } catch (error: any) {
        if (error.name !== "AbortError") {
          callbacks.onError(error);
        }
      }
    };

    run();

    // Return cancel function
    return () => abortController.abort();
  },

  // Non-streaming query
  async query(
    agentId: string,
    request: PlaygroundQueryRequest
  ): Promise<PlaygroundQueryResponse> {
    const accessToken = await getAccessToken();

    const response = await fetch(`/api/agents/${agentId}/playground/query`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
  },
};
```

### 8.3 JSX Response Rendering

**Location**: `/home/sgodilla/Documents/Daemo/daemo-live-bridge/daemo-engine-frontend/src/components/daemo-jsx-renderer.tsx`

```typescript
export function DaemoJsxRenderer({
  jsx,
  dataKeys,
  agentId,
  threadId,
}: {
  jsx: string;
  dataKeys: string[];
  agentId: string;
  threadId: string;
}) {
  const [data, setData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!dataKeys || dataKeys.length === 0) {
        setData({});
        setLoading(false);
        return;
      }

      try {
        const accessToken = await getAccessToken();
        const keysParam = dataKeys.join(",");

        const response = await fetch(
          `/api/agents/${agentId}/threads/${threadId}/data?keys=${keysParam}`,
          {
            headers: {
              "Authorization": `Bearer ${accessToken}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch data: ${response.statusText}`);
        }

        const fetchedData = await response.json();
        setData(fetchedData);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [dataKeys, agentId, threadId]);

  if (loading) {
    return <div>Loading data...</div>;
  }

  if (error) {
    return <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>;
  }

  try {
    // Parse and render JSX
    const rendered = parseAndRenderJsx(jsx, data);
    return <div className="daemo-jsx-content">{rendered}</div>;
  } catch (err: any) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Failed to render JSX: {err.message}</AlertDescription>
      </Alert>
    );
  }
}

// JSX parser and renderer
function parseAndRenderJsx(jsx: string, data: Record<string, any>): React.ReactNode {
  // Strip comments
  const cleanJsx = jsx.replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

  // Parse component tree
  const elements = parseJsxElements(cleanJsx);

  // Render each element
  return elements.map((el, i) => renderComponent(el, data, i));
}

function renderComponent(
  element: ParsedElement,
  data: Record<string, any>,
  key: number
): React.ReactNode {
  const { tagName, props, children } = element;

  // Built-in components
  switch (tagName) {
    case "Card":
      return <Card key={key} {...props}>{children.map((c, i) => renderComponent(c, data, i))}</Card>;

    case "CardHeader":
      return <CardHeader key={key}>{children.map((c, i) => renderComponent(c, data, i))}</CardHeader>;

    case "DataTable":
      const tableData = data[props.dataKey];
      return <DataTable key={key} data={tableData} columns={props.columns} />;

    case "LineChart":
      const chartData = data[props.dataKey];
      return (
        <ResponsiveContainer width="100%" height={300}>
          <RechartsLineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={props.xKey} />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey={props.yKey} stroke="#8884d8" />
          </RechartsLineChart>
        </ResponsiveContainer>
      );

    // HTML elements
    case "div":
    case "span":
    case "p":
    case "h1":
    case "h2":
    case "h3":
    case "ul":
    case "li":
      const Component = tagName;
      return <Component key={key} {...props}>{children.map((c, i) => renderComponent(c, data, i))}</Component>;

    // Text nodes
    default:
      if (typeof element === "string") {
        return renderMarkdown(element);
      }
      return null;
  }
}
```

**Supported Components**:
- **Layout**: Card, CardHeader, CardTitle, CardDescription, CardContent
- **Data**: DataTable, LineChart, BarChart, AreaChart, PieChart
- **HTML**: div, span, p, h1-h4, ul, ol, li, strong, em, code, pre
- **Markdown**: Text nodes are rendered as markdown

### 8.4 Message Display Component

**Location**: `/home/sgodilla/Documents/Daemo/daemo-live-bridge/daemo-engine-frontend/src/components/playground/PlaygroundMessage.tsx`

```typescript
export function PlaygroundMessage({
  message,
  agentId,
  threadId,
}: {
  message: Message;
  agentId: string;
  threadId?: string;
}) {
  const isUser = message.role === "user";

  return (
    <div className={cn(
      "flex gap-3 p-4",
      isUser ? "justify-end" : "justify-start"
    )}>
      {!isUser && <Avatar><AvatarFallback>AI</AvatarFallback></Avatar>}

      <div className={cn(
        "max-w-[80%] rounded-lg p-4",
        isUser ? "bg-primary text-primary-foreground" : "bg-muted"
      )}>
        {/* JSX response */}
        {message.jsx && threadId && (
          <DaemoJsxRenderer
            jsx={message.jsx}
            dataKeys={message.dataKeys || []}
            agentId={agentId}
            threadId={threadId}
          />
        )}

        {/* Text/markdown response */}
        {message.content && !message.jsx && (
          <Streamdown className="prose dark:prose-invert">
            {message.content}
          </Streamdown>
        )}

        {/* Tool calls */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              <span>Tool Calls ({message.toolCalls.length})</span>
            </CollapsibleTrigger>
            <CollapsibleContent>
              {message.toolCalls.map((tc, i) => (
                <div key={i} className="mt-2 border-l-2 pl-3">
                  <div className="font-mono text-sm">{tc.toolName}</div>
                  <div className="text-xs text-muted-foreground">
                    {JSON.stringify(tc.parameters, null, 2)}
                  </div>
                  {tc.result && (
                    <div className="mt-1 text-xs">
                      Result: {JSON.stringify(tc.result).substring(0, 100)}...
                    </div>
                  )}
                  {tc.error && (
                    <div className="mt-1 text-xs text-destructive">
                      Error: {tc.error}
                    </div>
                  )}
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Footer */}
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>{formatTimestamp(message.timestamp)}</span>
          {message.executionTimeMs && (
            <Badge variant="outline">{message.executionTimeMs}ms</Badge>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => copyToClipboard(message.content || message.jsx)}
          >
            <Copy className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {isUser && <Avatar><AvatarFallback>U</AvatarFallback></Avatar>}
    </div>
  );
}
```

---

## 9. Complete Data Flow

### 9.1 End-to-End Query Flow

```
┌──────────────────────────────────────────────────────────────────┐
│ 1. AGENT CREATION (Developer)                                     │
├──────────────────────────────────────────────────────────────────┤
│ Developer writes service:                                         │
│   class MyService {                                               │
│     @DaemoFunction({ ... })                                       │
│     async myTool(input) { return result; }                        │
│   }                                                               │
│                                                                    │
│ Uses DaemoBuilder:                                                │
│   const session = new DaemoBuilder()                              │
│     .withServiceName("my_service")                                │
│     .withSystemPrompt("...")                                      │
│     .registerService(new MyService())                             │
│     .build();                                                     │
│                                                                    │
│ Establishes connection:                                           │
│   new DaemoHostedConnection(config, session).start();             │
└──────────────────┬───────────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────────┐
│ 2. REGISTRATION (gRPC Gateway)                                    │
├──────────────────────────────────────────────────────────────────┤
│ Connection established to Gateway (port 50052)                    │
│ Sends SessionData with function schemas                           │
│ Gateway stores function registry:                                 │
│   {                                                               │
│     "myTool": {                                                   │
│       service: "my_service",                                      │
│       parameters: [...],                                          │
│       return_type: {...}                                          │
│     }                                                             │
│   }                                                               │
└──────────────────┬───────────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────────┐
│ 3. USER QUERY (Frontend)                                          │
├──────────────────────────────────────────────────────────────────┤
│ User types query in BeautifulPlaygroundChat                       │
│ Frontend calls: agentQueryApi.queryStream(agentId, request)       │
│ Request includes:                                                 │
│   - query: "What are the top products?"                           │
│   - threadId: "thread_123" (optional)                             │
│   - llmConfig: { provider, model, ... } (optional)                │
│   - role: "admin" (optional)                                      │
└──────────────────┬───────────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────────┐
│ 4. ENGINE PROCESSING (Rust Backend)                               │
├──────────────────────────────────────────────────────────────────┤
│ grpc_agent.rs::process_query() receives request                   │
│                                                                    │
│ [4a] Authentication & Credits                                     │
│   - Verify x-api-key                                              │
│   - Check organization credits ($0.02/query)                      │
│   - Deduct if sufficient                                          │
│                                                                    │
│ [4b] Configuration                                                │
│   - Load session (functions registry)                             │
│   - Create MemoryManager                                          │
│   - Initialize LLM providers                                      │
│                                                                    │
│ [4c] Thread Management                                            │
│   - Get existing thread OR create new UUID                        │
│   - Load conversation history (last 20 messages)                  │
│                                                                    │
│ [4d] Mode Selection                                               │
│   IF DAEMO_NATIVE_TOOLS_MODE=true:                                │
│     → Call process_native_query()  ← PRIMARY MODE                 │
│   ELSE IF direct_mode=true:                                       │
│     → Call process_direct_query()                                 │
│   ELSE:                                                           │
│     → Call process_standard_query() (two-phase)                   │
└──────────────────┬───────────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────────┐
│ 5. NATIVE MODE PROCESSING (native_mode.rs)                        │
├──────────────────────────────────────────────────────────────────┤
│ process_native_query() executes:                                  │
│                                                                    │
│ [5a] Generate Tool Schemas                                        │
│   native_tools.rs::generate_native_tool_schemas()                 │
│   Returns:                                                        │
│     - Built-in: execute_code, get_function_schema                 │
│     - User tools: myTool, anotherTool, ...                        │
│   Converted to Anthropic or OpenAI format                         │
│                                                                    │
│ [5b] Build System Prompt                                          │
│   Includes:                                                       │
│     - Function index with descriptions                            │
│     - Variable naming conventions                                 │
│     - Memory summary (available variables)                        │
│     - Custom prompt from developer                                │
│                                                                    │
│ [5c] Initialize Loop Tracker                                      │
│   ToolCallTracker::new() for detecting loops                      │
│                                                                    │
│ [5d] Main Loop (max 20 iterations)                                │
│   FOR step in 0..20:                                              │
│     ┌─────────────────────────────────────────────┐              │
│     │ Call LLM with:                               │              │
│     │   - system_prompt                            │              │
│     │   - conversation_history                     │              │
│     │   - tools (native schemas)                   │              │
│     └──────────────┬──────────────────────────────┘              │
│                    │                                              │
│                    ▼                                              │
│     ┌─────────────────────────────────────────────┐              │
│     │ LLM Response:                                │              │
│     │   - content: "Let me search products..."     │              │
│     │   - stop_reason: "tool_use"                  │              │
│     │   - tool_use_blocks: [                       │              │
│     │       {                                      │              │
│     │         id: "toolu_123",                     │              │
│     │         name: "searchProducts",              │              │
│     │         input: { searchTerm: "laptop" }      │              │
│     │       }                                      │              │
│     │     ]                                        │              │
│     └──────────────┬──────────────────────────────┘              │
│                    │                                              │
│                    ▼                                              │
│     IF stop_reason == "end_turn":                                │
│       → Return final response (EXIT LOOP)                        │
│                                                                    │
│     IF tool_use_blocks present:                                  │
│       FOR each tool_call:                                        │
│         ┌───────────────────────────────────────┐                │
│         │ Pre-execution Validation               │                │
│         │ tracker.check_call()                   │                │
│         │   - Identical params 3+ times? BLOCK   │                │
│         │   - Empty results 2+ times? BLOCK      │                │
│         │   - Add UX hints if needed             │                │
│         └──────────────┬────────────────────────┘                │
│                        │                                          │
│                        ▼                                          │
│         IF blocked:                                              │
│           → Add error result                                     │
│         ELSE:                                                    │
│           ┌─────────────────────────────────┐                    │
│           │ Execute Tool                     │                    │
│           │ (native_tool_router.rs)          │                    │
│           └──────────────┬──────────────────┘                    │
│                          │                                        │
│                          ▼                                        │
│           ┌─────────────────────────────────┐                    │
│           │ Route based on tool name:        │                    │
│           │   - execute_code → Deno runtime  │                    │
│           │   - get_function_schema → Lookup │                    │
│           │   - Other → gRPC to service      │                    │
│           └──────────────┬──────────────────┘                    │
│                          │                                        │
│                          ▼                                        │
│           ┌─────────────────────────────────┐                    │
│           │ Result Processing                │                    │
│           │   - Check for errors             │                    │
│           │   - Truncate if > max_tokens     │                    │
│           │   - Store in memory              │                    │
│           │   - Return NativeToolResult      │                    │
│           └──────────────┬──────────────────┘                    │
│                          │                                        │
│         tracker.record_result()                                  │
│                                                                    │
│       Format results for LLM history                             │
│       Add to conversation_history                                │
│       Add UX hints if problematic patterns                       │
│       Add step warning if step >= 15                             │
│                                                                    │
│   NEXT ITERATION (loop back to LLM call)                         │
│                                                                    │
│ IF max steps (20) reached:                                       │
│   → Final LLM call without tools for graceful response           │
└──────────────────┬───────────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────────┐
│ 6. TOOL EXECUTION (Native Tool Router)                            │
├──────────────────────────────────────────────────────────────────┤
│ Example: searchProducts tool                                      │
│                                                                    │
│ [6a] Router receives:                                             │
│   {                                                               │
│     id: "toolu_123",                                              │
│     name: "searchProducts",                                       │
│     input: { searchTerm: "laptop", limit: 10 }                    │
│   }                                                               │
│                                                                    │
│ [6b] Lookup in function registry                                  │
│   Found: service="product_service", handler=gRPC                  │
│                                                                    │
│ [6c] Publish to Redis channel                                     │
│   Channel: "function_calls:product_service"                       │
│   Payload: {                                                      │
│     call_id: "call_456",                                          │
│     function_name: "searchProducts",                              │
│     input_json: '{"searchTerm":"laptop","limit":10}'              │
│   }                                                               │
│                                                                    │
│ [6d] DaemoHostedConnection receives (Node.js)                     │
│   - Deserializes input_json                                       │
│   - Validates against Zod schema                                  │
│   - Calls handler: ProductService.searchProducts()                │
│   - Returns: [{ id:"1", name:"Laptop", price:999 }]               │
│                                                                    │
│ [6e] Result published back via Redis                              │
│   Channel: "function_results:call_456"                            │
│   Payload: {                                                      │
│     success: true,                                                │
│     result_json: '[{"id":"1","name":"Laptop","price":999}]'       │
│   }                                                               │
│                                                                    │
│ [6f] Router receives result                                       │
│   - Parses JSON                                                   │
│   - Truncates if > 25k tokens                                     │
│   - Stores in memory as "searchProducts_result"                   │
│   - Returns truncated version to LLM                              │
└──────────────────┬───────────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────────┐
│ 7. TRUNCATION (truncation.rs)                                     │
├──────────────────────────────────────────────────────────────────┤
│ truncate_result() called with:                                    │
│   - data: [{ id:"1", name:"Laptop", price:999 }, ...]             │
│   - storage_var: "searchProducts_result"                          │
│   - max_tokens: 25000                                             │
│                                                                    │
│ [7a] Calculate size                                               │
│   JSON length: ~5000 chars (~1250 tokens)                         │
│   Within limit → No truncation                                    │
│                                                                    │
│ [7b] If exceeded (example with 1M records):                       │
│   - Truncate to 90% of max_chars                                  │
│   - Cut at newline/comma boundary                                 │
│   - Append marker:                                                │
│     "[TRUNCATED - showing 1000/1000000 items. Use execute_code    │
│     to access full data as `searchProducts_result`]"              │
│                                                                    │
│ Returns:                                                          │
│   {                                                               │
│     truncated_data: { ... },                                      │
│     was_truncated: false,                                         │
│     original_count: 1,                                            │
│     shown_count: 1,                                               │
│     approx_tokens: 1250,                                          │
│     storage_var: "searchProducts_result"                          │
│   }                                                               │
└──────────────────┬───────────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────────┐
│ 8. MEMORY STORAGE (memory/manager.rs)                             │
├──────────────────────────────────────────────────────────────────┤
│ store_data() called:                                              │
│   thread_id: "thread_123"                                         │
│   name: "searchProducts_result"                                   │
│   data: [{ id:"1", name:"Laptop", price:999 }]                    │
│   description: "Result from searchProducts"                       │
│                                                                    │
│ [8a] Infer schema from data                                       │
│   Array<{ id: string, name: string, price: number }>              │
│                                                                    │
│ [8b] Create NamedDataEntry                                        │
│   {                                                               │
│     name: "searchProducts_result",                                │
│     description: "Result from searchProducts",                    │
│     data: [...],                                                  │
│     schema: { Array<{ id, name, price }> },                       │
│     item_count: 1,                                                │
│     created_at: 2026-01-24T10:30:00Z,                             │
│     last_accessed: 2026-01-24T10:30:00Z                           │
│   }                                                               │
│                                                                    │
│ [8c] Add to thread.memory.named_data                              │
│ [8d] Check limit (default: 50 entries)                            │
│   - If exceeded: Evict LRU (least recently accessed)              │
│ [8e] Save to Redis/MongoDB                                        │
│ [8f] Update in-memory cache                                       │
└──────────────────┬───────────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────────┐
│ 9. LLM FINAL RESPONSE                                             │
├──────────────────────────────────────────────────────────────────┤
│ LLM receives tool result in next turn:                            │
│   {                                                               │
│     type: "tool_result",                                          │
│     tool_use_id: "toolu_123",                                     │
│     content: '[{"id":"1","name":"Laptop","price":999}]'           │
│   }                                                               │
│                                                                    │
│ LLM generates final response:                                     │
│   - Option A (Text):                                              │
│     "I found 1 product matching 'laptop':                         │
│     • Laptop - $999"                                              │
│                                                                    │
│   - Option B (JSX):                                               │
│     <Card>                                                        │
│       <CardHeader>                                                │
│         <CardTitle>Search Results</CardTitle>                     │
│       </CardHeader>                                               │
│       <CardContent>                                               │
│         <DataTable dataKey="searchProducts_result"                │
│                    columns={["id","name","price"]} />             │
│       </CardContent>                                              │
│     </Card>                                                       │
│                                                                    │
│ stop_reason: "end_turn"                                           │
└──────────────────┬───────────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────────┐
│ 10. RESPONSE FORMATTING & STREAMING                               │
├──────────────────────────────────────────────────────────────────┤
│ native_mode.rs formats final result:                              │
│   NativeQueryResult {                                             │
│     response_type: "jsx",  // or "text"                           │
│     jsx: "<Card>...</Card>",                                      │
│     data_keys: ["searchProducts_result"],                         │
│     thread_id: "thread_123",                                      │
│     execution_time_ms: 2341,                                      │
│     tool_interactions: [                                          │
│       {                                                           │
│         tool_name: "searchProducts",                              │
│         parameters_json: '{"searchTerm":"laptop","limit":10}',    │
│         result_json: '[{...}]',                                   │
│         success: true,                                            │
│         execution_time_ms: 234                                    │
│       }                                                           │
│     ]                                                             │
│   }                                                               │
│                                                                    │
│ grpc_agent.rs streams events:                                     │
│   1. { type: "thought", content: "Searching products..." }        │
│   2. { type: "toolCall", toolName: "searchProducts", ... }        │
│   3. { type: "toolResult", toolName: "searchProducts", ... }      │
│   4. { type: "finalResponse", responseType: "jsx", jsx: "...", ...}│
└──────────────────┬───────────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────────┐
│ 11. FRONTEND RENDERING                                            │
├──────────────────────────────────────────────────────────────────┤
│ BeautifulPlaygroundChat receives events via SSE                   │
│                                                                    │
│ [11a] toolCall event                                              │
│   - Adds tool call to message.toolCalls[]                         │
│   - UI shows: "Calling searchProducts..."                         │
│                                                                    │
│ [11b] toolResult event                                            │
│   - Updates tool call status to "success"                         │
│   - Stores result (collapsed by default)                          │
│                                                                    │
│ [11c] finalResponse event                                         │
│   - Detects responseType: "jsx"                                   │
│   - Stores jsx and dataKeys in message                            │
│   - Sets threadId for continuity                                  │
│   - Marks isStreaming = false                                     │
│                                                                    │
│ PlaygroundMessage renders:                                        │
│   - Sees message.jsx exists                                       │
│   - Renders <DaemoJsxRenderer jsx={...} dataKeys={...} />         │
│                                                                    │
│ DaemoJsxRenderer:                                                 │
│   [11d] Fetch data                                                │
│     GET /agents/{agentId}/threads/{threadId}/data?keys=searchProducts_result│
│     Returns: { searchProducts_result: [{...}] }                   │
│                                                                    │
│   [11e] Parse JSX                                                 │
│     - Strip comments                                              │
│     - Parse component tree                                        │
│     - Identify components: Card, DataTable                        │
│                                                                    │
│   [11f] Render components                                         │
│     <Card>                                                        │
│       <CardHeader><CardTitle>Search Results</CardTitle></CardHeader>│
│       <CardContent>                                               │
│         <DataTable                                                │
│           data={[{ id:"1", name:"Laptop", price:999 }]}           │
│           columns={["id","name","price"]}                         │
│         />                                                        │
│       </CardContent>                                              │
│     </Card>                                                       │
│                                                                    │
│ User sees beautifully formatted table with product data           │
└──────────────────────────────────────────────────────────────────┘
```

---

## 10. Reference Implementation

### 10.1 Daemo SF 311 Agent Overview

**Location**: `/home/sgodilla/Documents/Daemo/daemo-live-bridge/daemo-sf-311-agent`

This agent provides AI-powered access to FBI NIBRS (National Incident-Based Reporting System) crime data stored in Google BigQuery.

**Key Features**:
- Custom SQL query execution against BigQuery
- 100+ UCR offense codes
- Security: SELECT-only, dangerous keyword blocking
- Automatic table name qualification
- Result limiting (max 10,000 rows)
- Comprehensive system prompt with schema documentation

### 10.2 Service Setup

**File**: `src/services/daemoService.ts`

```typescript
export function initializeDaemoService(): SessionData {
  const builder = new DaemoBuilder()
    .withServiceName("nibrs_crime_service")
    .withSystemPrompt(NIBRS_SYSTEM_PROMPT);  // Lines 8-449

  builder.registerService(new NIBRSCrimeFunctions());

  sessionData = builder.build();
  sessionData.Port = 50052;
  return sessionData;
}

// System prompt includes:
// - BigQuery schema documentation
// - Table structures (agencies, administrative_segment, offense_segment, etc.)
// - Common query patterns
// - Critical rules (default data_year=2025, population handling, etc.)
// - Data caveats
```

### 10.3 Function Implementation

**File**: `src/services/nibrsFunctions.ts`

```typescript
export class NIBRSCrimeFunctions {
  private bigquery: BigQuery;

  constructor() {
    // Initialize BigQuery client with credentials
    const serviceAccountJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    const credentials = JSON.parse(serviceAccountJson);
    this.bigquery = new BigQuery({
      projectId: "daemo-daemon-testing",
      credentials,
    });
  }

  @DaemoFunction({
    description: `Execute a custom SQL query against the NIBRS BigQuery database.

      SECURITY RULES:
      - Only SELECT queries allowed
      - Dangerous keywords (INSERT, UPDATE, DELETE, DROP, etc.) blocked
      - Table names auto-qualified to prevent injection
      - Results limited to max 10,000 rows

      USAGE:
      Use this when you need to query data that doesn't fit standard patterns.
      The system prompt contains full schema documentation.`,
    tags: ["nibrs", "custom", "sql", "query", "bigquery"],
    category: "NIBRS",
    inputSchema: ExecuteCustomQueryInput,  // Zod schema
    outputSchema: CustomQueryOutput,        // Zod schema
  })
  async executeCustomQuery(
    input: z.infer<typeof ExecuteCustomQueryInput>
  ): Promise<z.infer<typeof CustomQueryOutput>> {
    // Security: Only SELECT
    const sqlTrimmed = input.sql.trim().toUpperCase();
    if (!sqlTrimmed.startsWith("SELECT")) {
      throw new Error("Only SELECT queries are allowed for security reasons.");
    }

    // Security: Block dangerous keywords
    const dangerousKeywords = [
      "INSERT", "UPDATE", "DELETE", "DROP", "ALTER",
      "CREATE", "TRUNCATE", "MERGE", "GRANT", "REVOKE"
    ];
    for (const keyword of dangerousKeywords) {
      if (sqlTrimmed.includes(keyword)) {
        throw new Error(`Query contains forbidden keyword: ${keyword}`);
      }
    }

    // Auto-qualify table names to prevent injection
    let sql = input.sql;
    const tables = [
      "agencies", "administrative_segment", "offense_segment",
      "offender_segment", "victim_segment", "arrestee_segment",
      "law_enforcement_employees", "property_segment"
    ];

    for (const table of tables) {
      // Replace unqualified table names with fully qualified ones
      const regex = new RegExp(`(?<!\\.)\\b${table}\\b`, "gi");
      sql = sql.replace(regex, `\`${PROJECT_ID}.${DATASET}.${table}\``);
    }

    // Enforce result limit
    const maxLimit = Math.min(input.limit || 1000, 10000);
    if (!sql.toUpperCase().includes("LIMIT")) {
      sql = `${sql} LIMIT ${maxLimit}`;
    }

    // Execute query
    const rows = await this.runQuery(sql);

    return {
      results: rows,
      row_count: rows.length,
      columns: Object.keys(rows[0] || {}),
      truncated: rows.length >= maxLimit,
    };
  }

  private async runQuery(sql: string): Promise<any[]> {
    const options = { query: sql, location: "US" };
    const [job] = await this.bigquery.createQueryJob(options);
    const [rows] = await job.getQueryResults();
    return rows;
  }
}
```

### 10.4 Schema Definitions

**File**: `src/services/nibrs.schemas.ts`

```typescript
import { z } from "zod";

// Helper for LLM quirks (null/empty string coercion)
const optionalString = z
  .string()
  .nullish()
  .transform((val) => (val === null || val === "" ? undefined : val));

// UCR Offense Codes (100+ codes)
export const UCROffenseCodeEnum = z.enum([
  "09A",  // Murder & Nonnegligent Manslaughter
  "09B",  // Negligent Manslaughter
  "120",  // Robbery
  "13A",  // Aggravated Assault
  "13B",  // Simple Assault
  "200",  // Arson
  "210",  // Extortion/Blackmail
  "220",  // Burglary/Breaking & Entering
  // ... 100+ more codes
]);

// Input schema for custom query
export const ExecuteCustomQueryInput = z.object({
  sql: z.string().describe(
    "Custom SQL query to execute against NIBRS BigQuery database. " +
    "Must be a SELECT query. See system prompt for schema documentation."
  ),
  limit: z.number()
    .nullish()
    .transform((val) => val ?? 10000)
    .describe("Maximum number of rows to return (default: 10000, max: 10000)"),
});

// Output schema
export const CustomQueryOutput = z.object({
  results: z.array(z.record(z.string(), z.any()))
    .describe("Query results as array of objects"),
  row_count: z.number()
    .describe("Number of rows returned"),
  columns: z.array(z.string())
    .describe("Column names in results"),
  truncated: z.boolean()
    .describe("Whether results were truncated due to limit"),
});
```

### 10.5 Express API Setup

**File**: `src/app.ts`

```typescript
import express from "express";
import { configDotenv } from "dotenv";
import { initializeDaemoService, startHostedConnection } from "./services/daemoService";
import * as agentController from "./controllers/agentController";

configDotenv();

const app = express();
const port = process.env.PORT || 5000;

// Initialize Daemo
const sessionData = initializeDaemoService();
console.log(`Registered ${sessionData.Functions.length} functions`);

// Start hosted connection (if API key exists)
await startHostedConnection(sessionData);

// Middleware
app.use(express.json());
app.use(cors());

// Routes
app.post("/agent/query", agentController.processQuery);
app.post("/agent/query-stream", agentController.processQueryStreamed);
app.post("/agent/threads", agentController.createThread);
app.get("/agent/threads", agentController.listThreads);
app.get("/agent/threads/:threadId", agentController.getThread);
app.delete("/agent/threads/:threadId", agentController.deleteThread);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
```

### 10.6 Query Controller

**File**: `src/controllers/agentController.ts`

```typescript
export const processQuery = async (req: Request, res: Response) => {
  const { query, thread_id, max_tokens, direct_mode } = req.body;

  const sessionData = getSessionData();
  const llmConfig = buildLlmConfig(max_tokens);
  const client = getDaemoClient();

  try {
    const result = await client.processQuery(query, {
      threadId: thread_id,
      sessionId: sessionData.ServiceName,
      llmConfig,
      directMode: direct_mode !== false,  // Default to true
      directModeSystemPrompt: DIRECT_MODE_SYSTEM_PROMPT,
    });

    res.status(200).json({
      success: result.success,
      response: result.response,
      threadId: result.threadId,
      toolInteractions: result.toolInteractions,
      executionTimeMs: result.executionTimeMs,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      errorMessage: error.message,
    });
  }
};

export const processQueryStreamed = (req: Request, res: Response) => {
  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const { query, thread_id } = req.body;
  const sessionData = getSessionData();
  const llmConfig = buildLlmConfig();
  const client = getDaemoClient();

  const stream = client.processQueryStreamed(
    query,
    {
      onData: (data) => {
        res.write(`data: ${JSON.stringify(data, null, 2)}\n\n`);
      },
      onError: (error) => {
        res.write(`event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
      },
      onEnd: () => {
        res.write(`event: end\ndata: {}\n\n`);
        res.end();
      },
    },
    {
      threadId: thread_id,
      sessionId: sessionData.ServiceName,
      llmConfig,
      directMode: true,
      directModeSystemPrompt: DIRECT_MODE_SYSTEM_PROMPT,
    }
  );

  // Handle client disconnect
  res.on("close", () => {
    stream.cancel();
  });
};
```

---

## 11. Key File References

### Backend (Rust)

| Component | File Path | Key Lines | Description |
|-----------|-----------|-----------|-------------|
| **Native Mode** | `src/ai/agent/native_mode.rs` | 249-718 | Main native mode processing loop |
| **Loop Detection** | `src/ai/agent/native_mode.rs` | 63-221 | ToolCallTracker implementation |
| **Schema Generation** | `src/ai/native_tools.rs` | 26-72 | Generate tool schemas from session |
| **Built-in Tools** | `src/ai/native_tools.rs` | 288-358 | execute_code, get_function_schema |
| **Tool Routing** | `src/ai/native_tool_router.rs` | 48-143 | Route tool calls to executors |
| **Truncation** | `src/ai/truncation.rs` | 40-95 | Result truncation logic |
| **Claude API** | `src/ai/llm/claude.rs` | 24-220 | Anthropic implementation |
| **OpenAI API** | `src/ai/llm/openai_compatible.rs` | 25-180 | OpenAI-compatible implementation |
| **LLM Traits** | `src/ai/llm/traits.rs` | 9-178 | Abstract LLM interface |
| **Query Processing** | `src/grpc_agent.rs` | 307-700+ | Main query handler |
| **Memory Manager** | `src/memory/manager.rs` | 32-147 | Thread and data management |
| **Memory Types** | `src/memory/types.rs` | 31-113 | Data structures |
| **Main Entry** | `src/main.rs` | 55-300 | Server startup |

### Node SDK

| Component | File Path | Description |
|-----------|-----------|-------------|
| **Main Exports** | `src/index.ts` | Public API exports |
| **DaemoBuilder** | `src/builder/daemo-builder.ts` | Agent configuration builder |
| **Decorators** | `src/decorators/daemo-function.ts` | @DaemoFunction, @DaemoSchema |
| **Hosted Connection** | `src/connection/daemo-hosted-connection.ts` | gRPC service registration |
| **Client** | `src/connection/daemo-client.ts` | Query execution client |
| **Function Handler** | `src/handler/function-handler.ts` | Function execution logic |
| **Types** | `src/types/*.ts` | TypeScript type definitions |

### Frontend

| Component | File Path | Lines | Description |
|-----------|-----------|-------|-------------|
| **Playground Chat** | `src/components/playground/BeautifulPlaygroundChat.tsx` | 820 | Main playground component |
| **Message Display** | `src/components/playground/PlaygroundMessage.tsx` | 330 | Message rendering |
| **Input Component** | `src/components/playground/PlaygroundInput.tsx` | 380 | User input |
| **JSX Renderer** | `src/components/daemo-jsx-renderer.tsx` | 675 | JSX component rendering |
| **API Client** | `src/lib/api/agent-query.ts` | 142 | Query API client |
| **Types** | `src/lib/agent-query-types.ts` | 135 | Type definitions |
| **State Store** | `src/store/store.ts` | 200 | Zustand store |

### Reference Implementation

| Component | File Path | Description |
|-----------|-----------|-------------|
| **Main App** | `src/app.ts` | Express server setup |
| **Daemo Service** | `src/services/daemoService.ts` | DaemoBuilder configuration |
| **Functions** | `src/services/nibrsFunctions.ts` | Tool implementations |
| **Schemas** | `src/services/nibrs.schemas.ts` | Zod schemas |
| **Controller** | `src/controllers/agentController.ts` | HTTP request handlers |

---

## 12. Improvement Guidelines

### 12.1 Adding New LLM Providers

To add a new LLM provider (e.g., Gemini, Cohere):

1. **Create provider implementation** (`src/ai/llm/new_provider.rs`):
   ```rust
   pub struct NewProvider {
       api_key: String,
       endpoint: String,
   }

   impl LlmProvider for NewProvider {
       async fn generate(&self, request: LlmRequest) -> DaemoResult<LlmResponse> {
           // Convert request to provider format
           // Make API call
           // Parse response to LlmResponse
       }
   }
   ```

2. **Add response parser**:
   ```rust
   fn parse_new_provider_response(body: &Value) -> DaemoResult<LlmResponse> {
       // Extract content
       // Extract tool calls (if supported)
       // Map stop_reason
   }
   ```

3. **Register in provider factory** (`src/ai/llm/mod.rs`)

### 12.2 Extending Native Mode

**Add new built-in tools**:

1. Define schema in `native_tools.rs`:
   ```rust
   fn get_my_tool_schema() -> NativeToolSchema {
       NativeToolSchema {
           name: "my_tool".to_string(),
           description: "Does something useful".to_string(),
           parameters: /* ... */,
       }
   }
   ```

2. Add to `generate_native_tool_schemas()`:
   ```rust
   schemas.push(get_my_tool_schema());
   ```

3. Handle in router (`native_tool_router.rs`):
   ```rust
   match tool_call.name.as_str() {
       "my_tool" => {
           // Execute logic
           // Return NativeToolResult
       },
       // ...
   }
   ```

**Improve loop detection**:

Modify `ToolCallTracker` in `native_mode.rs`:
- Add new pattern detection (e.g., parameter similarity instead of exact match)
- Adjust thresholds (e.g., allow 5 retries instead of 3)
- Add more sophisticated UX hints

### 12.3 Frontend Improvements

**Add new JSX components**:

1. Define component in `daemo-jsx-renderer.tsx`:
   ```typescript
   case "MyChart":
     const data = dataStore[props.dataKey];
     return <MyChartComponent data={data} {...props} />;
   ```

2. Document in system prompt for LLMs to use

**Improve streaming UX**:
- Add progress indicators for long-running queries
- Show partial results as they arrive
- Add cancel button during streaming

### 12.4 Memory System Enhancements

**Implement context compression**:

1. Add summarization step in `memory/manager.rs`:
   ```rust
   pub async fn summarize_old_messages(
       &self,
       thread_id: &str,
   ) -> DaemoResult<()> {
       // Get messages older than N turns
       // Call LLM to summarize
       // Store summary, remove originals
   }
   ```

2. Call during message addition when threshold reached

**Add vector embeddings**:
- Store embeddings of named data descriptions
- Enable semantic search: "Find similar data to X"
- Use for intelligent data eviction (keep semantically unique data)

### 12.5 Performance Optimizations

**Parallel tool execution**:

Currently tools execute sequentially. Implement parallel execution:

```rust
// In native_mode.rs
let futures: Vec<_> = tool_calls.iter()
    .map(|tc| execute_native_tool(tc, &exec_ctx))
    .collect();

let results = futures::future::join_all(futures).await;
```

**Caching**:
- Cache function registry lookups
- Cache LLM responses for identical queries (with TTL)
- Cache data schema inferences

**Streaming optimization**:
- Send tool results incrementally instead of waiting for all
- Stream partial data for large arrays

### 12.6 Testing Strategy

**Unit tests** for:
- Schema generation (Zod → JSON Schema)
- Loop detection (identical params, empty results)
- Truncation (various data sizes)
- Provider response parsing

**Integration tests** for:
- End-to-end query flow
- Multi-turn conversations
- Thread persistence
- Tool execution routing

**Load tests** for:
- Concurrent queries
- Large result sets
- Memory usage under load

### 12.7 Security Hardening

**Input validation**:
- Validate all query parameters
- Sanitize user-provided SQL (in custom query tools)
- Rate limiting per agent/organization

**Output sanitization**:
- Prevent XSS in JSX responses
- Validate data fetched for JSX rendering
- Escape user data in markdown

**Authentication**:
- Implement API key rotation
- Add role-based access control (RBAC)
- Audit logging for sensitive operations

---

## Conclusion

This document provides a comprehensive overview of the Daemo Engine ecosystem. Key takeaways:

1. **Native Mode** is the core innovation, using LLM-native tool calling for reliability
2. **Function schemas** bridge developer code and LLM understanding through Zod validation
3. **Memory management** enables multi-turn conversations with persistent data
4. **Truncation** prevents context overflow while maintaining data access via `execute_code`
5. **Loop detection** ensures efficient execution by preventing retry patterns
6. **Multi-provider support** allows flexibility in LLM choice
7. **Rich responses** via JSX rendering enable data visualization
8. **Reference implementation** shows production patterns for building agents

When improving the Daemo platform, focus on:
- **Developer experience**: Make agent creation as simple as possible
- **LLM reliability**: Improve prompts, schemas, and loop detection
- **Performance**: Optimize hot paths (schema generation, tool routing, truncation)
- **Observability**: Add metrics, logging, and debugging tools

The architecture is designed for extensibility - new providers, tools, and features can be added without disrupting existing functionality.


-=====-
Ok, what I need you to do is to thouroughly analyze this repo of the Daemo SF 311 Agent and determine if the functions to query the FBI NIBRS dataset are actually correct. It seems like the agent has been having severe issues answering even simple questions like 'Sort all the agencies in CT by the incident counts they have for the most common crime state-wide'. It also seems like the agent is completely unable to write correct custom SQL queries for the executeCustomQuery function. But, I want you to investigate all of the functions and make sure that all of them are correct and work and that we have proper unit tests for all of them. Here is the current schema for the FBI NIBRS Big Query database:

# NIBRS CRIME DATA - BIGQUERY SCHEMA

## Dataset: \`daemo-daemon-testing.nibrs_data\`

---

## TABLES

### \`agencies\`

Reference table for law enforcement agencies. **Join on \`ori\` field.**

| Column      | Type    | Description                                                    |
| ----------- | ------- | -------------------------------------------------------------- |
| ori         | STRING  | Primary key. 9-character agency identifier (e.g., 'CA0010100') |
| agency_name | STRING  | Full agency name (e.g., 'Los Angeles Police Department')       |
| city_name   | STRING  | City where agency is located                                   |
| state_abbr  | STRING  | Two-letter state code (e.g., 'CA')                             |
| state_code  | STRING  | Two-digit numeric state FIPS code                              |
| county_code | STRING  | County FIPS code                                               |
| population  | STRING  | Population served by agency (cast to INT64 for calculations)   |
| msa_code    | STRING  | Metropolitan Statistical Area code                             |
| is_nibrs    | BOOLEAN | Whether agency participates in NIBRS reporting                 |

**Important Notes:**

- **To filter by state:** Use \`WHERE state_abbr = 'TX'\` (abbreviation) OR \`WHERE state_name = 'Texas'\` (full name)
- **NEVER use:** \`WHERE state = ...\` (this column does not exist)

**Example rows:**
\`\`\`
ori: AL0032500 | state_abbr: AL | state_name: Alabama | agency_name: Department of Conservation, Montgomery | is_nibrs: true
ori: AL0080800 | state_abbr: AL | state_name: Alabama | agency_name: Hayden Police Department | is_nibrs: true
ori: TX0010100 | state_abbr: TX | state_name: Texas | agency_name: Houston Police Department | is_nibrs: true
\`\`\`

### \`administrative_segment\`

One row per crime incident. Primary incident-level table.

| Column                  | Type   | Description                                                         |
| ----------------------- | ------ | ------------------------------------------------------------------- |
| ori                     | STRING | FK → agencies.ori                                                   |
| incident_number         | STRING | Agency case number (unique within agency)                           |
| incident_date           | DATE   | Date incident occurred                                              |
| incident_date_hour      | INT64  | Hour of day (0-23)                                                  |
| data_year               | INT64  | Year reported (2020-2025)                                           |
| total_offense_segments  | INT64  | Number of offenses                                                  |
| total_victim_segments   | INT64  | Number of victims                                                   |
| total_offender_segments | INT64  | Number of offenders                                                 |
| total_arrestee_segments | INT64  | Number of arrestees                                                 |
| cleared_exceptionally   | STRING | 'A'=Death of Offender, 'B'=Prosecution Declined, 'N'=Not Applicable |

**Example rows:**
\`\`\`
ori: AK0010500 | incident_number: UG-W84JHSCTD | incident_date: 2020-11-07 | incident_date_hour: 15 | data_year: 2020
ori: AL0010000 | incident_number: 2W2HPU72JLKD | incident_date: 2020-01-18 | incident_date_hour: 13 | data_year: 2020
\`\`\`

### \`offense_segment\`

One row per offense. An incident can have multiple offenses.

| Column                         | Type   | Description                                            |
| ------------------------------ | ------ | ------------------------------------------------------ |
| ori                            | STRING | FK → agencies.ori                                      |
| incident_number                | STRING | Links to administrative_segment                        |
| incident_date                  | DATE   | Date incident occurred                                 |
| data_year                      | INT64  | Year reported                                          |
| ucr_offense_code               | STRING | FBI offense code (see UCR codes below)                 |
| offense_attempted_or_completed | STRING | 'A'=Attempted, 'C'=Completed                           |
| location_type                  | STRING | Two-digit location code                                |
| bias_motivation                | STRING | Hate crime bias code ('88'=None)                       |
| type_weapon_force_involved1    | STRING | Primary weapon code ('11'=Firearm, '12'=Handgun, etc.) |
| type_weapon_force_involved2    | STRING | Secondary weapon code (if applicable)                  |
| type_weapon_force_involved3    | STRING | Tertiary weapon code (if applicable)                   |

**Example rows:**
\`\`\`
ori: AL0010200 | incident_number: V-6QXTJIBB0W | incident_date: 2023-09-30 | ucr_offense_code: 09A | offense_attempted_or_completed: C | location_type: 18 | type_weapon_force_involved1: 11.0 | bias_motivation: 88 | data_year: 2023
ori: AL0010200 | incident_number: U302O-JYLGST | incident_date: 2022-12-19 | ucr_offense_code: 09A | offense_attempted_or_completed: C | location_type: 20 | type_weapon_force_involved1: 11.0 | bias_motivation: 88 | data_year: 2022
\`\`\`

### \`victim_segment\`

One row per victim.

| Column                 | Type   | Description                                               |
| ---------------------- | ------ | --------------------------------------------------------- |
| ori                    | STRING | FK → agencies.ori                                         |
| incident_number        | STRING | Links to administrative_segment                           |
| incident_date          | DATE   | Date incident occurred                                    |
| data_year              | INT64  | Year reported                                             |
| victim_sequence_number | INT64  | Victim number (1, 2, 3...)                                |
| type_of_victim         | STRING | 'I'=Individual, 'B'=Business, 'L'=Law Enforcement Officer |
| age_of_victim          | STRING | Age ('01'-'99', 'NB'=Newborn, NULL=Unknown)               |
| sex_of_victim          | STRING | 'M'=Male, 'F'=Female, 'U'=Unknown                         |
| race_of_victim         | STRING | 'W'=White, 'B'=Black, 'A'=Asian, 'I'=Native American      |
| ucr_offense_code1      | STRING | Primary offense affecting victim                          |

**Example rows:**
\`\`\`
ori: TXHPD0000 | incident_number: 37418GZ42SCT | incident_date: 2025-06-28 | victim_sequence_number: 1 | ucr_offense_code1: 120 | type_of_victim: B | data_year: 2025
ori: MI2583900 | incident_number: P-23NGWP-Z2Z | incident_date: 2023-06-21 | victim_sequence_number: 2 | ucr_offense_code1: 120 | type_of_victim: B | data_year: 2023
\`\`\`

### \`arrestee_segment\`

One row per arrestee.

| Column                  | Type   | Description                                       |
| ----------------------- | ------ | ------------------------------------------------- |
| ori                     | STRING | FK → agencies.ori                                 |
| incident_number         | STRING | Links to administrative_segment                   |
| arrest_date             | DATE   | Date of arrest                                    |
| data_year               | INT64  | Year reported                                     |
| ucr_arrest_offense_code | STRING | Offense code for arrest                           |
| age_of_arrestee         | STRING | Age                                               |
| sex_of_arrestee         | STRING | 'M', 'F', 'U'                                     |
| race_of_arrestee        | STRING | Race code                                         |
| type_of_arrest          | STRING | 'O'=On-View, 'S'=Summoned, 'T'=Taken Into Custody |

**Example rows:**
\`\`\`
ori: AK0012200 | incident_number: HQ2HPUXVZ21A | arrest_date: 2021-01-18 | ucr_arrest_offense_code: 220 | age_of_arrestee: 42 | sex_of_arrestee: M | race_of_arrestee: W | data_year: 2020
ori: AL0010500 | incident_number: QNAYTGDAEX4 | arrest_date: 2020-05-02 | ucr_arrest_offense_code: 35A | age_of_arrestee: 39 | sex_of_arrestee: M | race_of_arrestee: B | data_year: 2020
\`\`\`

### \`law_enforcement_employees\`

FBI Law Enforcement Employees dataset with year-specific population data for agencies.

| Column                | Type    | Description                                                    |
| --------------------- | ------- | -------------------------------------------------------------- |
| data_year             | INTEGER | Year of data (2015-2024)                                       |
| ori                   | STRING  | Agency identifier (9 characters) - FK to agencies.ori          |
| pub_agency_name       | STRING  | Official agency name                                           |
| state_abbr            | STRING  | Two-letter state code                                          |
| population            | INTEGER | **Population served by agency** (INTEGER - no casting needed!) |
| population_group_desc | STRING  | FBI's official population category                             |
| county_name           | STRING  | County where agency is located                                 |
| agency_type_name      | STRING  | Type of agency (City, County, State, etc.)                     |
| officer_ct            | INTEGER | Number of sworn officers                                       |
| civilian_ct           | INTEGER | Number of civilian employees                                   |

**FBI Population Categories** (from \`population_group_desc\`):

- "Cities 1,000,000 and over"
- "Cities from 500,000 thru 999,999"
- "Cities from 250,000 thru 499,999"
- "Cities from 100,000 thru 249,999"
- "Cities from 50,000 thru 99,999"
- "Cities from 25,000 thru 49,999"
- "Cities from 10,000 thru 24,999"
- "Cities from 2,500 thru 9,999"
- "Cities under 2,500"

**Example rows:**
\`\`\`
data_year: 2024 | ori: AK0010100 | pub_agency_name: Anchorage | state_abbr: AK | population: 286958 | population_group_desc: Cities from 250,000 thru 499,999 | officer_ct: 366
data_year: 2023 | ori: AK0010100 | pub_agency_name: Anchorage | state_abbr: AK | population: 285026 | population_group_desc: Cities from 250,000 thru 499,999 | officer_ct: 400
\`\`\`

**CRITICAL: Always join on BOTH \`ori\` AND \`data_year\`:**
\`\`\`sql
JOIN law_enforcement_employees le
ON o.ori = le.ori AND o.data_year = le.data_year
\`\`\`

This ensures year-specific population matching for accurate per-capita calculations.


-====-
Feel free to even query the Big Query DB yourself to see if the schema is correct and is returning correct data.
