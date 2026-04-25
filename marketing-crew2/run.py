"""
Marketing Crew 2 - Single API Call Version (OpenRouter)
=======================================================
Instead of multiple CrewAI agents making dozens of API calls,
this script sends ONE prompt via OpenRouter and gets all outputs at once.
"""

import os
from openai import OpenAI
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.getenv("OPENROUTER_API_KEY"),
)

EXTRA_HEADERS = {
    "HTTP-Referer": "http://localhost",
    "X-Title": "Marketing Crew Project",
}


def run_marketing_crew(
    product_name: str,
    product_description: str,
    target_audience: str,
    budget: str,
):
    """Run the entire marketing crew workflow in a single API call."""

    current_date = datetime.now().strftime("%Y-%m-%d")

    prompt = f"""You are a marketing AI team.

**Product**: {product_name}
**Description**: {product_description}
**Target Audience**: {target_audience}
**Budget**: {budget}
**Today's Date**: {current_date}

Return ALL of the following. Format everything clearly in markdown.

---

## 1. Market Research

- Key market trends relevant to this product.
- Target audience demographics, pain points, and buying behavior.
- 3-5 competitors and their positioning.
- Opportunities and threats.

---

## 2. Marketing Strategy

- Brand positioning and unique value proposition (UVP).
- 3-4 SMART marketing goals.
- Recommended channels with budget allocation from {budget}.
- 30-day high-level action plan.

---

## 3. Content Calendar (Next 2 Weeks)

Create a table:
| Day | Platform | Content Type | Topic/Hook | CTA |

Include at least 10 entries across Instagram, Twitter/X, LinkedIn, Blog.

---

## 4. Three Social Media Posts (Ready to Publish)

### Post 1 - Twitter/X
- Under 280 characters with hashtags.

### Post 2 - Instagram Caption
- Engaging caption with emojis, CTA, and 10-15 hashtags.

### Post 3 - LinkedIn Post
- Professional tone with hook, value, and CTA.

---

## 5. Blog Draft with SEO Keywords

Write a blog post (800-1000 words):
- SEO-optimized title
- 10 target SEO keywords listed at top
- Proper heading structure (H1, H2, H3)
- Engaging introduction
- 3-4 body sections
- Conclusion with CTA
- Meta description (under 160 characters)

---

Be specific, actionable, and creative.
"""

    models_to_try = [
        "qwen/qwen3-30b-a3b",            # very cheap, fast
        "qwen/qwen3-8b",                  # cheapest fallback
        "meta-llama/llama-3.3-70b-instruct:free",  # free fallback
    ]

    print("=" * 60)
    print(">> Marketing Crew 2 - Single API Call (OpenRouter)")
    print("=" * 60)
    print(f"Product : {product_name}")
    print(f"Audience: {target_audience}")
    print(f"Budget  : {budget}")
    print(f"Date    : {current_date}")
    print("=" * 60)
    print("\nGenerating complete marketing package (1 API call)...\n")

    response = None
    for model in models_to_try:
        try:
            print(f"Trying: {model}")
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "user", "content": prompt}
                ],
                extra_headers=EXTRA_HEADERS,
            )
            print(f"Success with: {model}\n")
            break
        except Exception as e:
            print(f"Failed: {str(e)[:150]}\n")
            continue

    if response is None:
        print("ERROR: All models failed. Try again later.")
        return None

    output = response.choices[0].message.content

    # Save output to file
    os.makedirs("output", exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = f"output/marketing_output_{timestamp}.md"
    with open(output_file, "w", encoding="utf-8") as f:
        f.write(f"# Marketing Package - {product_name}\n")
        f.write(f"_Generated on {current_date}_\n\n")
        f.write(output)

    print("[DONE] Output saved to:", output_file)
    print("\n" + "=" * 60)
    print("FULL OUTPUT")
    print("=" * 60 + "\n")
    import sys
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    print(output)

    return output


if __name__ == "__main__":
    run_marketing_crew(
        product_name="AI Powered Excel Automation Tool",
        product_description="A tool that automates repetitive tasks in Excel using AI, saving time and reducing errors.",
        target_audience="Small and Medium Enterprises (SMEs)",
        budget="Rs. 50,000",
    )
