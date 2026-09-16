"""
SOUQ AL MENA - RICE BLOG IMAGE GENERATOR (Simple Version)
Uses PIL only (no matplotlib dependency)
Run: python generate_blog_images_simple.py
Output: /blog/images/ folder with all optimized images
"""

from PIL import Image, ImageDraw, ImageFont
import os

# Color scheme
GOLD = (201, 169, 97)
TEAL = (45, 90, 78)
LIGHT_TEAL = (179, 217, 204)
LIGHT_GOLD = (232, 212, 168)
GREEN = (107, 182, 77)
LIGHT_GREEN = (209, 240, 217)
GRAY = (204, 204, 204)
DARK_GRAY = (51, 51, 51)
WHITE = (255, 255, 255)

# Create images directory
os.makedirs('blog/images', exist_ok=True)

def create_gradient_image(width, height, color1, color2, filename):
    """Create a gradient image"""
    img = Image.new('RGB', (width, height))
    pixels = img.load()

    for y in range(height):
        ratio = y / height
        r = int(color1[0] * (1 - ratio) + color2[0] * ratio)
        g = int(color1[1] * (1 - ratio) + color2[1] * ratio)
        b = int(color1[2] * (1 - ratio) + color2[2] * ratio)

        for x in range(width):
            pixels[x, y] = (r, g, b)

    return img

print("Generating 7 Strategic Blog Images...")
print("=" * 60)

# ============================================================================
# IMAGE 1: HERO IMAGE - Gradient with containers
# ============================================================================
print("\n1. Creating Hero Image (rice-trade-hero.jpg)...")

img = create_gradient_image(1920, 1080, GOLD, TEAL, 'temp')
draw = ImageDraw.Draw(img, 'RGBA')

# Draw container rectangles
for x in range(0, 1920, 250):
    draw.rectangle([(x, 300), (x+200, 700)], fill=(255, 255, 255, 50),
                   outline=(201, 169, 97, 200), width=3)

# Add text
try:
    title_font = ImageFont.truetype("arial.ttf", 90)
    subtitle_font = ImageFont.truetype("arial.ttf", 50)
except:
    # Fallback: smaller font
    title_font = ImageFont.load_default()
    subtitle_font = ImageFont.load_default()

# Title with shadow
draw.text((963, 393), "UAE Rice Trade Hub", font=title_font,
         fill=(0, 0, 0, 100), anchor="mm")
draw.text((960, 390), "UAE Rice Trade Hub", font=title_font,
         fill=(255, 255, 255, 255), anchor="mm")

# Subtitle
draw.text((963, 523), "Strategic Import Export Intelligence", font=subtitle_font,
         fill=(0, 0, 0, 100), anchor="mm")
draw.text((960, 520), "Strategic Import Export Intelligence", font=subtitle_font,
         fill=GOLD, anchor="mm")

img.save('blog/images/rice-trade-hero.jpg', quality=85, optimize=True)
print("   [OK] rice-trade-hero.jpg (1920x1080, professional gradient)")

# ============================================================================
# IMAGE 2: SUPPLIER BREAKDOWN PIE CHART (Simple Circle Representation)
# ============================================================================
print("\n2. Creating Supplier Breakdown Chart (supplier-breakdown-chart.jpg)...")

img = Image.new('RGB', (1200, 800), color=WHITE)
draw = ImageDraw.Draw(img, 'RGBA')

# Background
draw.rectangle([(0, 0), (1200, 800)], fill=WHITE, outline=TEAL, width=3)

# Title
try:
    title_font = ImageFont.truetype("arial.ttf", 40)
    text_font = ImageFont.truetype("arial.ttf", 28)
    small_font = ImageFont.truetype("arial.ttf", 18)
except:
    title_font = text_font = small_font = ImageFont.load_default()

draw.text((600, 40), "UAE Rice Supplier Market Share 2025", font=title_font,
         fill=TEAL, anchor="mm")

# Draw supplier bars instead of pie (easier without matplotlib)
suppliers = [
    ("India", 47.94, GOLD),
    ("Pakistan", 42.21, TEAL),
    ("Vietnam", 9.44, GREEN),
    ("Others", 0.41, GRAY)
]

bar_y = 150
bar_height = 100
max_width = 900
colors_idx = 0

for supplier, percent, color in suppliers:
    bar_width = (percent / 100) * max_width

    # Draw bar
    draw.rectangle([(150, bar_y), (150 + bar_width, bar_y + bar_height)],
                  fill=color, outline=DARK_GRAY, width=2)

    # Add text
    draw.text((140, bar_y + bar_height//2), supplier, font=text_font,
             fill=DARK_GRAY, anchor="rm")
    draw.text((160 + bar_width//2, bar_y + bar_height//2), f"{percent}%",
             font=text_font, fill=WHITE, anchor="mm")

    bar_y += 120

# Add legend
draw.text((600, 750), "Source: TradeInt Trade Intelligence Data",
         font=small_font, fill=GRAY, anchor="mm")

img.save('blog/images/supplier-breakdown-chart.jpg', quality=85, optimize=True)
print("   [OK] supplier-breakdown-chart.jpg (1200x800, horizontal bar chart)")

# ============================================================================
# IMAGE 3: BASMATI GROWTH CHART
# ============================================================================
print("\n3. Creating Basmati Growth Chart (basmati-growth-projection.jpg)...")

img = Image.new('RGB', (1200, 700), color=WHITE)
draw = ImageDraw.Draw(img, 'RGBA')

# Background
draw.rectangle([(0, 0), (1200, 700)], fill=WHITE, outline=TEAL, width=3)

# Title
draw.text((600, 40), "Basmati vs Global Rice Market Growth",
         font=title_font, fill=TEAL, anchor="mm")

# Draw chart area
chart_left = 150
chart_top = 120
chart_right = 1100
chart_bottom = 600

# Grid background
draw.rectangle([(chart_left, chart_top), (chart_right, chart_bottom)],
              fill=(249, 249, 249), outline=GRAY, width=1)

# Y-axis label
draw.text((80, 200), "CAGR %", font=small_font, fill=TEAL, anchor="lm")

# Legend
draw.line([(150, 70), (200, 70)], fill=GOLD, width=3)
draw.text((210, 70), "Basmati Rice (7-12%)", font=small_font,
         fill=TEAL, anchor="lm")

draw.line([(500, 70), (550, 70)], fill=GRAY, width=3)
draw.text((560, 70), "Global Rice (2.5-3.1%)", font=small_font,
         fill=TEAL, anchor="lm")

# Draw lines representing growth
# Basmati line (high)
basmati_points = [(150, 500), (400, 430), (650, 350), (900, 270)]
for i in range(len(basmati_points) - 1):
    draw.line([basmati_points[i], basmati_points[i+1]], fill=GOLD, width=4)

# Global line (flat)
global_points = [(150, 480), (400, 470), (650, 460), (900, 450)]
for i in range(len(global_points) - 1):
    draw.line([global_points[i], global_points[i+1]], fill=GRAY, width=3)

# Add data point circles
for x, y in basmati_points:
    draw.ellipse([(x-8, y-8), (x+8, y+8)], fill=GOLD, outline=WHITE, width=2)

# Add source
draw.text((600, 650), "Projections based on market analysis",
         font=small_font, fill=GRAY, anchor="mm")

img.save('blog/images/basmati-growth-projection.jpg', quality=85, optimize=True)
print("   [OK] basmati-growth-projection.jpg (1200x700, line chart)")

# ============================================================================
# IMAGE 4: GCC DEMAND DRIVERS
# ============================================================================
print("\n4. Creating GCC Demand Drivers (gcc-demand-drivers.jpg)...")

img = Image.new('RGB', (1200, 900), color=WHITE)
draw = ImageDraw.Draw(img, 'RGBA')

# Title
draw.text((600, 40), "GCC Rice Demand Drivers", font=title_font,
         fill=TEAL, anchor="mm")

# Create 4 boxes
drivers = [
    ("📈 Population Growth", "11M+ in UAE", LIGHT_GOLD),
    ("✈️ Tourism Boom", "19.6M Visitors", LIGHT_TEAL),
    ("👥 Expatriate Pop.", "88% Density", LIGHT_GOLD),
    ("🍽️ Hospitality", "Sector Growth", LIGHT_TEAL),
]

box_width = 250
box_height = 200
start_x = 100
start_y = 150

for idx, (driver, stat, color) in enumerate(drivers):
    x = start_x + (idx % 2) * (box_width + 100)
    y = start_y + (idx // 2) * (box_height + 100)

    # Draw box
    draw.rectangle([(x, y), (x + box_width, y + box_height)],
                  fill=color, outline=TEAL, width=2)

    # Text
    draw.text((x + box_width//2, y + 50), driver, font=text_font,
             fill=TEAL, anchor="mm")
    draw.text((x + box_width//2, y + 150), stat, font=small_font,
             fill=DARK_GRAY, anchor="mm")

# Center circle
center_x = 600
center_y = 550
radius = 60

# Draw circle (approximate with box for simplicity)
draw.ellipse([(center_x - radius, center_y - radius),
             (center_x + radius, center_y + radius)],
            fill=TEAL, outline=GOLD, width=3)

draw.text((center_x, center_y), "Multiple\nGrowth\nDrivers", font=text_font,
         fill=WHITE, anchor="mm")

# Source
draw.text((600, 850), "Source: MENA Market Analysis 2026",
         font=small_font, fill=GRAY, anchor="mm")

img.save('blog/images/gcc-demand-drivers.jpg', quality=85, optimize=True)
print("   [OK] gcc-demand-drivers.jpg (1200x900, infographic)")

# ============================================================================
# IMAGE 5: SUPPLY CHAIN FLOW
# ============================================================================
print("\n5. Creating Supply Chain Flow (supply-chain-flow-diagram.jpg)...")

img = Image.new('RGB', (1200, 800), color=WHITE)
draw = ImageDraw.Draw(img, 'RGBA')

# Title
draw.text((600, 40), "Rice Supply Chain: Source to Distribution",
         font=title_font, fill=TEAL, anchor="mm")

# Top boxes (Source → Consolidation)
top_boxes = [
    (150, 150, "India\nPakistan", GREEN),
    (400, 150, "Shipping", GOLD),
    (650, 150, "Jebel Ali\nPort", TEAL),
    (900, 150, "Consolidation", GOLD),
]

# Bottom boxes (Distribution)
bottom_boxes = [
    (200, 500, "Saudi Arabia", LIGHT_GOLD),
    (500, 500, "UAE", LIGHT_GOLD),
    (750, 500, "Qatar", LIGHT_GOLD),
    (1000, 500, "Oman", LIGHT_GOLD),
]

# Draw top boxes
for x, y, text, color in top_boxes:
    draw.rectangle([(x-50, y), (x+50, y+80)], fill=color, outline=TEAL, width=2)
    draw.text((x, y+40), text, font=text_font, fill=WHITE, anchor="mm")

# Draw bottom boxes
for x, y, text, color in bottom_boxes:
    draw.rectangle([(x-50, y), (x+50, y+80)], fill=color, outline=TEAL, width=2)
    draw.text((x, y+40), text, font=text_font, fill=DARK_GRAY, anchor="mm")

# Draw arrows
arrow_color = GOLD
# Top line arrows
for i in range(len(top_boxes) - 1):
    x1 = top_boxes[i][0] + 50
    x2 = top_boxes[i+1][0] - 50
    y = top_boxes[i][1] + 40
    draw.line([(x1, y), (x2, y)], fill=arrow_color, width=3)
    # Arrow head
    draw.polygon([(x2, y), (x2-10, y-8), (x2-10, y+8)], fill=arrow_color)

# Down arrows
for top, bottom in [(0, 0), (2, 1), (2, 2), (3, 3)]:
    x = top_boxes[top][0]
    y1 = top_boxes[top][1] + 80
    y2 = bottom_boxes[bottom][1]
    draw.line([(x, y1), (x, y2)], fill=TEAL, width=3)

img.save('blog/images/supply-chain-flow-diagram.jpg', quality=85, optimize=True)
print("   [OK] supply-chain-flow-diagram.jpg (1200x800, flowchart)")

# ============================================================================
# IMAGE 6: COMPLIANCE FRAMEWORK
# ============================================================================
print("\n6. Creating Compliance Framework (compliance-framework.jpg)...")

img = Image.new('RGB', (1200, 900), color=WHITE)
draw = ImageDraw.Draw(img, 'RGBA')

# Title
draw.text((600, 40), "GCC Rice Import Compliance Framework",
         font=title_font, fill=TEAL, anchor="mm")

# Process boxes
boxes = [
    (600, 100, "Import\nDocumentation", LIGHT_GOLD),
    (250, 300, "UAE ESMA\nStandards", LIGHT_GOLD),
    (600, 300, "Saudi SABER\nCertificate", LIGHT_GOLD),
    (950, 300, "GCC Customs\nClearance", LIGHT_GOLD),
    (600, 550, "APPROVED [DONE]", GREEN),
]

# Draw boxes
for x, y, text, color in boxes:
    box_size = 80 if 'APPROVED' in text else 90
    draw.rectangle([(x - box_size//2, y - 40), (x + box_size//2, y + 40)],
                  fill=color, outline=TEAL, width=2)
    draw.text((x, y), text, font=text_font, fill=DARK_GRAY, anchor="mm")

# Draw arrows
arrow_points = [
    (600, 140, 250, 260),  # Down-left
    (600, 140, 600, 260),  # Down
    (600, 140, 950, 260),  # Down-right
    (250, 340, 600, 510),  # Left to center
    (600, 340, 600, 510),  # Center down
    (950, 340, 600, 510),  # Right to center
]

for x1, y1, x2, y2 in arrow_points:
    draw.line([(x1, y1), (x2, y2)], fill=GOLD, width=2)

# Checklist
checklist_y = 700
draw.text((100, checklist_y), "Key Requirements:", font=text_font, fill=TEAL)
items = ["[OK] Bilingual labeling", "[OK] Pesticide limits", "[OK] Origin verification", "[OK] Documentation"]
for i, item in enumerate(items):
    draw.text((100, checklist_y + 40 + (i*35)), item, font=small_font, fill=DARK_GRAY)

img.save('blog/images/compliance-framework.jpg', quality=85, optimize=True)
print("   [OK] compliance-framework.jpg (1200x900, compliance flowchart)")

# ============================================================================
# IMAGE 7: SOUQ AL MENA ADVANTAGE VENN DIAGRAM
# ============================================================================
print("\n7. Creating Souq Advantage (souq-advantage-venn.jpg)...")

img = Image.new('RGB', (1000, 800), color=WHITE)
draw = ImageDraw.Draw(img, 'RGBA')

# Title
draw.text((500, 40), "Souq Al Mena: Competitive Advantage",
         font=title_font, fill=TEAL, anchor="mm")

# Draw three circles (approximate Venn diagram)
# Left circle
draw.ellipse([(150, 200), (400, 500)], fill=LIGHT_GOLD, outline=GOLD, width=2)
draw.text((250, 280), "Direct\nSourcing", font=text_font, fill=DARK_GRAY, anchor="mm")

# Right circle
draw.ellipse([(550, 200), (800, 500)], fill=LIGHT_TEAL, outline=TEAL, width=2)
draw.text((675, 280), "GCC\nLogistics", font=text_font, fill=DARK_GRAY, anchor="mm")

# Bottom circle
draw.ellipse([(300, 380), (650, 680)], fill=LIGHT_GREEN, outline=GREEN, width=2)
draw.text((475, 480), "Sustainability", font=text_font, fill=DARK_GRAY, anchor="mm")

# Center text
draw.text((475, 400), "Souq Al Mena\nINTEGRATED\nADVANTAGE", font=text_font,
         fill=WHITE, anchor="mm",
         bbox=(150, 320, 800, 480))

# Legend text
draw.text((100, 650), "Direct Sourcing + GCC Logistics + Sustainability =",
         font=small_font, fill=TEAL)
draw.text((100, 685), "Transparency, Efficiency, Reliability",
         font=small_font, fill=TEAL, weight='bold')

img.save('blog/images/souq-advantage-venn.jpg', quality=85, optimize=True)
print("   [OK] souq-advantage-venn.jpg (1000x800, Venn diagram)")

# ============================================================================
# SUMMARY
# ============================================================================
print("\n" + "=" * 60)
print("SUCCESS: ALL 7 IMAGES GENERATED SUCCESSFULLY!")
print("=" * 60)

# List files
import glob
images = sorted(glob.glob('blog/images/*.jpg'))
print(f"\nImages saved to: blog/images/")
print(f"Total images created: {len(images)}\n")

total_size = 0
for img_file in images:
    file_size = os.path.getsize(img_file) / 1024  # KB
    total_size += file_size
    print(f"   [OK] {os.path.basename(img_file):45} {file_size:6.1f} KB")

print(f"\n   Total size: {total_size:.1f} KB ({total_size/1024:.1f} MB)")

print("\n" + "=" * 60)
print("NEXT STEPS:")
print("=" * 60)
print("""
1. All 7 images created and optimized
2. Images are in blog/images/ folder
3. Ready to deploy rice blog:
   - Images are already integrated in HTML
   - Test in browser: All images should load
   - Deploy to live site
   - Submit to Google Search Console

Your images are ready!
""")
