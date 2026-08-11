import pymysql
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
# የእርስዎን ሞዴሎች እዚህ ጋር ይጠሩ
from app.models import Base, Category, SubCategory

# የ MySQL ማገናኛ ሊንክ (XAMPP MySQL)
DATABASE_URL = "mysql+pymysql://root:@127.0.0.1:3306/campusmarket_db"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 16ቱን ምድቦች እና ሁሉንም ንዑሳን ዕቃዎች የያዘ የዳታ ዝርዝር (Database Seeding)
directory_data = [
  {
    "name": "Electronics",
    "icon": "💻",
    "adsCount": "1.2K listings",
    "items": [
      {"name": "Laptop", "icon": "💻", "adsCount": "245 ads"},
      {"name": "Desktop Computer", "icon": "🖥️", "adsCount": "84 ads"},
      {"name": "Monitor", "icon": "📺", "adsCount": "56 ads"},
      {"name": "Keyboard", "icon": "⌨️", "adsCount": "112 ads"},
      {"name": "Mouse", "icon": "🖱️", "adsCount": "95 ads"},
      {"name": "Webcam", "icon": "📷", "adsCount": "32 ads"},
      {"name": "Printer", "icon": "🖨️", "adsCount": "47 ads"},
      {"name": "Calculator", "icon": "🧮", "adsCount": "180 ads"},
      {"name": "USB Flash Drive", "icon": "💾", "adsCount": "310 ads"},
      {"name": "External Hard Drive", "icon": "💾", "adsCount": "88 ads"},
      {"name": "SSD", "icon": "💾", "adsCount": "142 ads"},
      {"name": "Power Bank", "icon": "🔋", "adsCount": "220 ads"},
      {"name": "Phone Charger", "icon": "🔌", "adsCount": "340 ads"},
      {"name": "Laptop Charger", "icon": "🔌", "adsCount": "150 ads"},
      {"name": "Earphones", "icon": "🎧", "adsCount": "420 ads"},
      {"name": "Headphones", "icon": "🎧", "adsCount": "180 ads"},
      {"name": "Bluetooth Speaker", "icon": "🔊", "adsCount": "160 ads"},
      {"name": "Tablet", "icon": "📱", "adsCount": "115 ads"},
      {"name": "Smartwatch", "icon": "⌚", "adsCount": "95 ads"},
      {"name": "Wi-Fi Router", "icon": "📶", "adsCount": "72 ads"}
    ]
  },
  {
    "name": "Mobile Phones & Accessories",
    "icon": "📱",
    "adsCount": "480 listings",
    "items": [
      {"name": "Android Phone", "icon": "📱", "adsCount": "410 ads"},
      {"name": "iPhone", "icon": "📱", "adsCount": "520 ads"},
      {"name": "Feature Phone", "icon": "📞", "adsCount": "64 ads"},
      {"name": "Phone Case", "icon": "🔌", "adsCount": "1.2K ads"},
      {"name": "Screen Protector", "icon": "🛡️", "adsCount": "950 ads"},
      {"name": "Memory Card", "icon": "💾", "adsCount": "320 ads"},
      {"name": "SIM Card", "icon": "💳", "adsCount": "140 ads"},
      {"name": "SIM Eject Tool", "icon": "📌", "adsCount": "60 ads"},
      {"name": "USB Cable", "icon": "🔌", "adsCount": "850 ads"},
      {"name": "OTG Adapter", "icon": "🔌", "adsCount": "110 ads"},
      {"name": "Wireless Charger", "icon": "🔋", "adsCount": "95 ads"},
      {"name": "Selfie Stick", "icon": "🤳", "adsCount": "40 ads"},
      {"name": "Mobile Tripod", "icon": "🔭", "adsCount": "75 ads"},
      {"name": "Ring Light", "icon": "💡", "adsCount": "115 ads"},
      {"name": "Phone Holder", "icon": "🚗", "adsCount": "130 ads"},
      {"name": "Bluetooth Earbuds", "icon": "🎧", "adsCount": "280 ads"}
    ]
  },
  {
    "name": "Academic Books",
    "icon": "📚",
    "adsCount": "2.4K listings",
    "items": [
      {"name": "Programming Books", "icon": "📚", "adsCount": "410 ads"},
      {"name": "Database Books", "icon": "📚", "adsCount": "150 ads"},
      {"name": "Networking Books", "icon": "📚", "adsCount": "130 ads"},
      {"name": "Cybersecurity Books", "icon": "📚", "adsCount": "95 ads"},
      {"name": "Artificial Intelligence Books", "icon": "📚", "adsCount": "180 ads"},
      {"name": "Data Structures Books", "icon": "📚", "adsCount": "210 ads"},
      {"name": "Operating System Books", "icon": "📚", "adsCount": "85 ads"},
      {"name": "Software Engineering Books", "icon": "📚", "adsCount": "140 ads"},
      {"name": "Mathematics Books", "icon": "📚", "adsCount": "310 ads"},
      {"name": "Physics Books", "icon": "📚", "adsCount": "240 ads"},
      {"name": "Chemistry Books", "icon": "📚", "adsCount": "185 ads"},
      {"name": "Biology Books", "icon": "📚", "adsCount": "195 ads"},
      {"name": "Accounting Books", "icon": "📚", "adsCount": "165 ads"},
      {"name": "Economics Books", "icon": "📚", "adsCount": "220 ads"},
      {"name": "Marketing Books", "icon": "📚", "adsCount": "140 ads"},
      {"name": "Management Books", "icon": "📚", "adsCount": "180 ads"},
      {"name": "Law Books", "icon": "📚", "adsCount": "115 ads"},
      {"name": "Medical Books", "icon": "📚", "adsCount": "290 ads"},
      {"name": "English Grammar Books", "icon": "📚", "adsCount": "135 ads"},
      {"name": "Dictionaries", "icon": "📚", "adsCount": "80 ads"},
      {"name": "Research Methodology Books", "icon": "📚", "adsCount": "95 ads"},
      {"name": "Thesis Writing Books", "icon": "📚", "adsCount": "70 ads"},
      {"name": "Entrance Exam Books", "icon": "📚", "adsCount": "120 ads"}
    ]
  },
  {
    "name": "Stationery",
    "icon": "✏️",
    "adsCount": "350 listings",
    "items": [
      {"name": "Notebook", "icon": "📓", "adsCount": "450 ads"},
      {"name": "Exercise Book", "icon": "📖", "adsCount": "620 ads"},
      {"name": "Pens", "icon": "🖊️", "adsCount": "850 ads"},
      {"name": "Pencils", "icon": "✏️", "adsCount": "510 ads"},
      {"name": "Mechanical Pencil", "icon": "✏️", "adsCount": "140 ads"},
      {"name": "Eraser", "icon": "🧼", "adsCount": "95 ads"},
      {"name": "Sharpener", "icon": "🧼", "adsCount": "80 ads"},
      {"name": "Ruler", "icon": "📏", "adsCount": "120 ads"},
      {"name": "Marker", "icon": "🖊️", "adsCount": "210 ads"},
      {"name": "Highlighter", "icon": "🖊️", "adsCount": "160 ads"},
      {"name": "Sticky Notes", "icon": "📄", "adsCount": "280 ads"},
      {"name": "Folder", "icon": "📁", "adsCount": "195 ads"},
      {"name": "Binder", "icon": "📁", "adsCount": "130 ads"},
      {"name": "File Organizer", "icon": "📁", "adsCount": "85 ads"},
      {"name": "Stapler", "icon": "📎", "adsCount": "95 ads"},
      {"name": "Staples", "icon": "📎", "adsCount": "40 ads"},
      {"name": "Glue", "icon": "🧴", "adsCount": "110 ads"},
      {"name": "Scissors", "icon": "✂️", "adsCount": "75 ads"},
      {"name": "A4 Paper", "icon": "📄", "adsCount": "340 ads"},
      {"name": "Paper Clips", "icon": "📎", "adsCount": "150 ads"}
    ]
  }
  # ሌሎቹም 16 ምድቦች በተመሳሳይ መልኩ እዚህ ውስጥ ይዘረዘራሉ...
]

def seed_categories():
    print("Connecting to MySQL to seed categories...")
    # ሰንጠረዦቹን መጀመሪያ ይፈጥራቸዋል
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # ዳታቤዙ ባዶ መሆኑን ማረጋገጫ
        if db.query(Category).count() == 0:
            print("Seeding campus categories and subcategories...")
            for cat_data in directory_data:
                db_category = Category(
                    name=cat_data["name"],
                    icon=cat_data["icon"],
                    ads_count=cat_data["adsCount"]
                )
                db.add(db_category)
                db.flush() # የ Category.id ቁጥር ለማግኘት ፍለሽ እናደርገዋለን
                
                # ንዑሳን ምድቦችን መጫኛ (Subcategories Seeding)
                for sub_data in cat_data["items"]:
                    db_subcategory = SubCategory(
                        name=sub_data["name"],
                        icon=sub_data["icon"],
                        ads_count=sub_data["adsCount"],
                        category_id=db_category.id
                    )
                    db.add(db_subcategory)
            
            db.commit()
            print("Success! Categories and Subcategories successfully seeded in MySQL! 🎉")
        else:
            print("Database is already seeded with categories. No changes made.")
    except Exception as e:
        db.rollback()
        print(f"Error during seeding: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_categories()