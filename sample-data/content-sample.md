# Section 2: Core Concepts + Demo Part 1 (Minutes 5–15)

**⏰ TIMING CHECK:** 10 minutes total. Concept explanation: 4 minutes max. If you're not at the demo by minute 9, you're behind.

---

## The Architecture Explanation (Minutes 5–9)

**[Pull up your diagram or whiteboard. You need a visual for this — words alone won't land.]**

**Say this:**

"Before I touch any code, I want to show you something. Because if you get this mental model wrong, nothing else will make sense."

**[Draw or display four boxes connected by arrows:]**

```
[Your App]  →  [Claude API]     [Claude API]  →  [Your App]  →  [Claude API]
 User msg       Returns              You run        Returns       Final
                tool_use             tool           result        response
```

"Most of you have used an LLM API before. You send a message, you get a response. One round trip. Done.

Tool use is **two round trips**. And that's the thing that surprises everyone the first time.

Here's what actually happens:

**Round trip one:** You send Claude a user message plus a list of tools it can use. Claude looks at the question, decides it needs to call a tool, and responds — not with an answer, but with a **request**. It says: 'I want to use the get_weather tool with city equals Tokyo.' That's it. No answer yet.

**[Point to the middle of the diagram]**

This is where YOUR code takes over. Claude has not called anything. Claude cannot call anything. Claude is just a text model — it returned structured JSON describing what it wants. You read that JSON, you run the function, you get the result.

**Round trip two:** Now you send Claude a second message — the entire conversation so far, PLUS the tool result. Claude reads the real data you just gave it, and NOW it writes the final answer.

**[Look around the room]**

If you take nothing else from today, take this: **Claude requests tools. You execute them. Claude never touches your systems directly.**"

---

## Pause for Comprehension (Minute 9)

**[Stop talking. Let it land for 3 seconds.]**

"Any questions on the architecture before I show you the code?"

**[Take max 1–2 quick questions. If a question is deep, say: "I want to show you that live — you'll see it in a second."]**

---

## Live Demo Part 1 (Minutes 9–15)

**[Open your pre-written demo file. Do NOT live-code from scratch — typos kill momentum.]**

**Say this:**

"Okay, let's see this in actual code. I'm going to run through the exact same pattern we just drew — request, tool_use response, execute, send result back, final answer. Watch what happens at each step."

### Step 1 — Show the tool definition

"First thing: the tool definition. This is how you tell Claude what tools exist. Three parts: a name, a description, and an input schema."

```python
tools = [{
    "name": "get_weather",
    "description": "Get current weather for a city",
    "input_schema": {
        "type": "object",
        "properties": {
            "city": {"type": "string", "description": "City name"},
            "units": {"type": "string", "enum": ["celsius", "fahrenheit"]}
        },
        "required": ["city"]
    }
}]
```

"The description matters more than you'd think. Claude reads this to decide whether and how to use the tool. Notice the `required` array at the bottom — this tells Claude which parameters it must always include."

### Step 2 — Show the first API call

"Now the first request. Nothing special here — just adding `tools=tools` to a normal API call."

```python
response = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    tools=tools,
    messages=[{"role": "user", "content": "What's the weather in Tokyo?"}]
)
```

**[Run it live. Show the output.]**

"Watch what comes back."

**[The response will show stop_reason: "tool_use". Point to it.]**

"See this? `stop_reason: tool_use`. Claude is not done — it's paused, waiting for us to run the tool. And look at `response.content` — it's a **list**. There's a tool_use block in there with the tool name and the inputs Claude decided to use.

This is the thing that breaks people's code the first time. They expect a string. They get a list of blocks. Let me show you what's inside."

```python
print(response.content)
# [TextBlock(text='...', type='text'),
#  ToolUseBlock(id='toolu_01...', input={'city': 'Tokyo', 'units': 'celsius'},
#               name='get_weather', type='tool_use')]
```

"Two blocks. A text block — sometimes Claude thinks out loud before requesting a tool — and a tool_use block with the actual request. We need to pull out the tool_use block, which we do by iterating through content and checking `block.type`."

### Step 3 — Show the execution and second API call

"Now we execute the tool — just a regular Python function call — and send everything back."

```python
# Find the tool_use block
tool_use_block = next(b for b in response.content if b.type == "tool_use")

# Execute the tool
tool_result = get_weather_data(city=tool_use_block.input["city"])

# Second API call - full conversation history required
response2 = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    tools=tools,
    messages=[
        {"role": "user", "content": "What's the weather in Tokyo?"},
        {"role": "assistant", "content": response.content},
        {
            "role": "user",
            "content": [{
                "type": "tool_result",
                "tool_use_id": tool_use_block.id,
                "content": str(tool_result)
            }]
        }
    ]
)
```

"Three messages in the second call. The original user message. The assistant's tool_use response — the whole content array, not just the tool block. And a user message containing the tool result, linked to the tool request by `tool_use_id`.

That linking matters. If you have multiple tool calls, Claude needs to know which result belongs to which request."

**[Run it. Show the final output with actual weather data.]**

"And now Claude has real data. Watch."

**[Show Claude's final response]**

"That's the complete loop. Two round trips, real data, real answer."

---

## Checkpoint (Minute 15)

**Say this:**

"Before we move to Exercise 1: in your own words, what happens between Claude's first response and Claude's second response? Someone tell me."

**[Wait for a volunteer. Give it 5 seconds — don't rescue them immediately.]**

**If they get it right:** "Exactly. Your code runs the tool. Claude never touches it."

**If they're partially right:** "Close — you've got the right idea. The key addition is that you have to send the full conversation history back, not just the result."

**If nobody answers:** "I'll give you the one-sentence version: between Claude's first and second response, your code runs the tool and sends the result back as part of the conversation. That's it. That's the whole pattern."

---

## 📋 Trainer Notes for This Section

**The diagram is non-negotiable:**
If you're in-person, draw it on a whiteboard in real time — it's more engaging than a static image. If you're on Zoom, use the whiteboard tool or have a slide ready.

**Demo file discipline:**
Run the demo from a pre-tested file. Not a Jupyter notebook. Not live-typed code. A clean `.py` file you've run three times this morning.

**The response.content moment:**
Slow down here deliberately. This is Bug #2 in Exercise 1. The more time you spend on "it's a list, not a string" now, the faster they'll fix it in 10 minutes.

**Common questions in this section:**

- **Q: "Why does Claude sometimes add a text block before the tool_use?"**
  A: "Claude thinks out loud. It might say 'Let me check the weather for you' before requesting the tool. Your code needs to handle both blocks — that's why we iterate through content instead of just grabbing index 0."

- **Q: "What if I don't send the full conversation history?"**
  A: "Claude has no memory between API calls — it won't know it ever requested a tool. You'll probably get a hallucinated answer. That's actually Bug #1 in your exercise."

- **Q: "What's the tool_use_id for?"**
  A: "Matching results to requests. You'll need it when Claude calls multiple tools in parallel — which we'll see in Demo Part 2."

- **Q: "Can I use async?"**
  A: "Yes, the SDK supports async. Same pattern, just `await client.messages.create(...)`. Out of scope for today but the docs have examples."

**What success looks like at minute 15:**
- Everyone has seen a complete tool use cycle run live
- Everyone understands response.content is a list
- Everyone understands the two-round-trip pattern