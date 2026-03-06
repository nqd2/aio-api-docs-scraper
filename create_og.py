import os
from PIL import Image

def create_og_image():
    width, height = 1200, 630
    # Soft off-white background (#f8fafc)
    img = Image.new('RGB', (width, height), color='#f8fafc')
    
    try:
        # Load the transparent logo
        logo = Image.open('public/logo.png').convert("RGBA")
        
        logo_w, logo_h = logo.size
        # target height of 450 pixels gives a nice breathing room on a 630px high banner
        target_h = 450
        target_w = int(logo_w * (target_h / logo_h))
        logo = logo.resize((target_w, target_h), Image.Resampling.LANCZOS)
        
        # center
        x = (width - target_w) // 2
        y = (height - target_h) // 2
        
        # Paste using logo as mask for its own alpha channel
        img.paste(logo, (x, y), logo)
    except Exception as e:
        print("Could not load logo:", e)
        
    img.save('app/opengraph-image.png')
    img.save('app/twitter-image.png')
    print("Successfully created opengraph images!")

if __name__ == '__main__':
    create_og_image()
