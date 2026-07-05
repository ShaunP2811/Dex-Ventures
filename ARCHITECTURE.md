# Prism — How It Works

A marketer fills in a short brief and gets back a client-ready media plan. Behind
the scenes the work is split into two very different jobs: **the numbers** (all
the money and budget maths) and **the words** (the audience targeting and ad
copy). They're deliberately kept apart — see *Why it's built this way* below.

The diagram reads top to bottom: the **brief goes in at the top**, the **finished
media plan comes out at the bottom**.

## The flow

```mermaid
flowchart TB
    IN(["INPUT · the campaign brief<br/>budget · goal · audience · brand website"]) --> P["Plan builder"]

    P --> NUM
    P -->|"only the channels + audience description —<br/>never the budget or any figure"| WORDS
    P --> VIS

    subgraph NUM["THE NUMBERS — worked out by fixed rules, no AI"]
        direction TB
        N1["Calculate the fees<br/>management · setup · reporting · tax"]
        N2["Split the budget across channels<br/>to match the campaign goal"]
        N3["Drop channels too small to perform<br/>and share their budget among the rest"]
        N4["Estimate the results<br/>reach · clicks · conversions"]
    end

    subgraph WORDS["THE WORDS — written by AI"]
        direction TB
        W1["Audience targeting for each platform"]
        W2["Ad headlines and captions"]
    end

    subgraph VIS["THE VISUALS"]
        direction TB
        V1["Use the brand's own image<br/>from their website"]
        V2["Or generate one that fits the goal (optional)"]
    end

    NUM --> R(["MEDIA PLAN · the finished proposal<br/>fees · budget split · results · targeting · ad creative"])
    WORDS --> R
    VIS --> R

    classDef startNode fill:#eaeaec,stroke:#9aa0a6,color:#17181c;
    classDef endNode fill:#e4002b,stroke:#a8001f,color:#ffffff;
    class IN startNode;
    class R endNode;
```

## What each part does

- **Input — the brief** — what the marketer fills in: how much to spend, the goal
  (Awareness, Traffic, or Conversion), who the audience is, and the brand's
  website.
- **The Numbers** — everything involving money. It works out every fee, splits
  the budget across Meta, Google, TikTok and LinkedIn to fit the goal, drops any
  channel too small to perform (and shares its budget out), and estimates the
  likely results. It runs on fixed, published rules, so every figure is exact and
  can be checked by hand.
- **The Words** — the AI part. It writes the audience targeting and the ad copy.
  It only ever sees the channels and a plain-English description of the audience —
  never the budget or any number.
- **The Visuals** — builds the ad mockups on the brand's own imagery (pulled from
  their website), or an image generated to fit the campaign goal.
- **Result — the media plan** — all of the above assembled into one clean,
  client-ready proposal.

## Why it's built this way

The money and the creative are kept completely separate. Anything with a number —
fees, the budget split, tax, the estimated results — is calculated by fixed rules,
so every figure is **exact and auditable**. The AI is used only where it genuinely
helps: writing the targeting and the ad wording. **No number ever passes through
the AI**, which is what makes the plan trustworthy.

## How it fits into a workflow

It's a single online tool. A marketer fills in the form and gets a plan back in
seconds. It can also run automatically — a CRM or an intake form can send a brief
in and receive the finished plan back, without anyone opening the tool.
