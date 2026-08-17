import { useState, useEffect } from 'react';
import ProductDetails from './ProductDetails';
import laptop_586 from '../../assets/laptop_586.webp';
import phone2 from '../../assets/phone2.jpg';
import c3 from '../../assets/c3.jpg';
import c4 from '../../assets/c4.jpg';
import c6 from '../../assets/c6.jpg';
import c7 from '../../assets/c7.jpg';

const bannerImages = [
  laptop_586,
  phone2,
  c3,
  c4,
  c6,
  c7
];


const defaultCategories = [
  {
    id: 1,
    name: 'Electronics',
    icon: '💻',
    adsCount: '1.2K listings',
    items: [
      { name: 'Laptop', icon: '💻', adsCount: '245 ads' },
      { name: 'Desktop Computer', icon: '🖥️', adsCount: '84 ads' },
      { name: 'Monitor', icon: '📺', adsCount: '56 ads' },
      { name: 'Keyboard', icon: '⌨️', adsCount: '112 ads' },
      { name: 'Mouse', icon: '🖱️', adsCount: '95 ads' },
      { name: 'Webcam', icon: '📷', adsCount: '32 ads' },
      { name: 'Printer', icon: '🖨️', adsCount: '47 ads' },
      { name: 'Calculator', icon: '🧮', adsCount: '180 ads' },
      { name: 'USB Flash Drive', icon: '💾', adsCount: '310 ads' },
      { name: 'External Hard Drive', icon: '💾', adsCount: '88 ads' },
      { name: 'SSD', icon: '💾', adsCount: '142 ads' },
      { name: 'Power Bank', icon: '🔋', adsCount: '220 ads' },
      { name: 'Phone Charger', icon: '🔌', adsCount: '340 ads' },
      { name: 'Laptop Charger', icon: '🔌', adsCount: '150 ads' },
      { name: 'Earphones', icon: '🎧', adsCount: '420 ads' },
      { name: 'Headphones', icon: '🎧', adsCount: '180 ads' },
      { name: 'Bluetooth Speaker', icon: '🔊', adsCount: '160 ads' },
      { name: 'Tablet', icon: '📱', adsCount: '115 ads' },
      { name: 'Smartwatch', icon: '⌚', adsCount: '95 ads' },
      { name: 'Wi-Fi Router', icon: '📶', adsCount: '72 ads' }
    ]
  },
  {
    id: 2,
    name: 'Mobile Phones & Accessories',
    icon: '📱',
    adsCount: '480 listings',
    items: [
      { name: 'Android Phone', icon: '📱', adsCount: '410 ads' },
      { name: 'iPhone', icon: '📱', adsCount: '520 ads' },
      { name: 'Feature Phone', icon: '📞', adsCount: '64 ads' },
      { name: 'Phone Case', icon: '🔌', adsCount: '1.2K ads' },
      { name: 'Screen Protector', icon: '🛡️', adsCount: '950 ads' },
      { name: 'Memory Card', icon: '💾', adsCount: '320 ads' },
      { name: 'SIM Card', icon: '💳', adsCount: '140 ads' },
      { name: 'SIM Eject Tool', icon: '📌', adsCount: '60 ads' },
      { name: 'USB Cable', icon: '🔌', adsCount: '850 ads' },
      { name: 'OTG Adapter', icon: '🔌', adsCount: '110 ads' },
      { name: 'Wireless Charger', icon: '🔋', adsCount: '95 ads' },
      { name: 'Selfie Stick', icon: '🤳', adsCount: '40 ads' },
      { name: 'Mobile Tripod', icon: '🔭', adsCount: '75 ads' },
      { name: 'Ring Light', icon: '💡', adsCount: '115 ads' },
      { name: 'Phone Holder', icon: '🚗', adsCount: '130 ads' },
      { name: 'Bluetooth Earbuds', icon: '🎧', adsCount: '280 ads' }
    ]
  },
  {
    id: 3,
    name: 'Academic Books',
    icon: '📚',
    adsCount: '2.4K listings',
    items: [
      { name: 'Programming Books', icon: '📚', adsCount: '410 ads' },
      { name: 'Database Books', icon: '📚', adsCount: '150 ads' },
      { name: 'Networking Books', icon: '📚', adsCount: '130 ads' },
      { name: 'Cybersecurity Books', icon: '📚', adsCount: '95 ads' },
      { name: 'Artificial Intelligence Books', icon: '📚', adsCount: '180 ads' },
      { name: 'Data Structures Books', icon: '📚', adsCount: '210 ads' },
      { name: 'Operating System Books', icon: '📚', adsCount: '85 ads' },
      { name: 'Software Engineering Books', icon: '📚', adsCount: '140 ads' },
      { name: 'Mathematics Books', icon: '📚', adsCount: '310 ads' },
      { name: 'Physics Books', icon: '📚', adsCount: '240 ads' },
      { name: 'Chemistry Books', icon: '📚', adsCount: '185 ads' },
      { name: 'Biology Books', icon: '📚', adsCount: '195 ads' },
      { name: 'Accounting Books', icon: '📚', adsCount: '165 ads' },
      { name: 'Economics Books', icon: '📚', adsCount: '220 ads' },
      { name: 'Marketing Books', icon: '📚', adsCount: '140 ads' },
      { name: 'Management Books', icon: '📚', adsCount: '180 ads' },
      { name: 'Law Books', icon: '📚', adsCount: '115 ads' },
      { name: 'Medical Books', icon: '📚', adsCount: '290 ads' },
      { name: 'English Grammar Books', icon: '📚', adsCount: '135 ads' },
      { name: 'Dictionaries', icon: '📚', adsCount: '80 ads' },
      { name: 'Research Methodology Books', icon: '📚', adsCount: '95 ads' },
      { name: 'Thesis Writing Books', icon: '📚', adsCount: '70 ads' },
      { name: 'Entrance Exam Books', icon: '📚', adsCount: '120 ads' }
    ]
  },
  {
    id: 4,
    name: 'Stationery',
    icon: '✏️',
    adsCount: '350 listings',
    items: [
      { name: 'Notebook', icon: '📓', adsCount: '450 ads' },
      { name: 'Exercise Book', icon: '📖', adsCount: '620 ads' },
      { name: 'Pens', icon: '🖊️', adsCount: '850 ads' },
      { name: 'Pencils', icon: '✏️', adsCount: '510 ads' },
      { name: 'Mechanical Pencil', icon: '✏️', adsCount: '140 ads' },
      { name: 'Eraser', icon: '🧼', adsCount: '95 ads' },
      { name: 'Sharpener', icon: '🧼', adsCount: '80 ads' },
      { name: 'Ruler', icon: '📏', adsCount: '120 ads' },
      { name: 'Marker', icon: '🖊️', adsCount: '210 ads' },
      { name: 'Highlighter', icon: '🖊️', adsCount: '160 ads' },
      { name: 'Sticky Notes', icon: '📄', adsCount: '280 ads' },
      { name: 'Folder', icon: '📁', adsCount: '195 ads' },
      { name: 'Binder', icon: '📁', adsCount: '130 ads' },
      { name: 'File Organizer', icon: '📁', adsCount: '85 ads' },
      { name: 'Stapler', icon: '📎', adsCount: '95 ads' },
      { name: 'Staples', icon: '📎', adsCount: '40 ads' },
      { name: 'Glue', icon: '🧴', adsCount: '110 ads' },
      { name: 'Scissors', icon: '✂️', adsCount: '75 ads' },
      { name: 'A4 Paper', icon: '📄', adsCount: '340 ads' },
      { name: 'Paper Clips', icon: '📎', adsCount: '150 ads' }
    ]
  },
  {
    id: 5,
    name: 'IT & Computer Accessories',
    icon: '🔌',
    adsCount: '810 listings',
    items: [
      { name: 'RAM', icon: '🔌', adsCount: '120 ads' },
      { name: 'SSD', icon: '💾', adsCount: '180 ads' },
      { name: 'HDD', icon: '💾', adsCount: '95 ads' },
      { name: 'Graphics Card', icon: '🖥️', adsCount: '45 ads' },
      { name: 'Processor (CPU)', icon: '🧠', adsCount: '60 ads' },
      { name: 'Motherboard', icon: '🔩', adsCount: '35 ads' },
      { name: 'Ethernet Cable', icon: '🧵', adsCount: '210 ads' },
      { name: 'HDMI Cable', icon: '📺', adsCount: '180 ads' },
      { name: 'VGA Cable', icon: '🖥️', adsCount: '90 ads' },
      { name: 'DisplayPort Cable', icon: '🖥️', adsCount: '50 ads' },
      { name: 'USB Hub', icon: '🔌', adsCount: '115 ads' },
      { name: 'USB Adapter', icon: '🔌', adsCount: '130 ads' },
      { name: 'Laptop Stand', icon: '🪑', adsCount: '85 ads' },
      { name: 'Cooling Pad', icon: '❄️', adsCount: '70 ads' },
      { name: 'Raspberry Pi', icon: '🍓', adsCount: '40 ads' },
      { name: 'Arduino Board', icon: '🔧', adsCount: '95 ads' },
      { name: 'Breadboard', icon: '🧱', adsCount: '150 ads' },
      { name: 'Sensors', icon: '📡', adsCount: '240 ads' },
      { name: 'Power Supply', icon: '🔋', adsCount: '65 ads' },
      { name: 'Network Switch', icon: '🔀', adsCount: '30 ads' }
    ]
  },
  {
    id: 6,
    name: 'Laboratory Equipment',
    icon: '🧪',
    adsCount: '190 listings',
    items: [
      { name: 'Lab Coat', icon: '🥼', adsCount: '85 ads' },
      { name: 'Safety Goggles', icon: '👓', adsCount: '40 ads' },
      { name: 'Laboratory Gloves', icon: '🧤', adsCount: '110 ads' },
      { name: 'Scientific Calculator', icon: '🧮', adsCount: '95 ads' },
      { name: 'Lab Notebook', icon: '📓', adsCount: '60 ads' },
      { name: 'Measuring Tape', icon: '📏', adsCount: '30 ads' },
      { name: 'Digital Multimeter', icon: '📟', adsCount: '45 ads' },
      { name: 'Electronic Components Kit', icon: '🔌', adsCount: '70 ads' },
      { name: 'Breadboard Kit', icon: '🧱', adsCount: '80 ads' },
      { name: 'Jumper Wires', icon: '🔌', adsCount: '150 ads' },
      { name: 'Test Tubes', icon: '🧪', adsCount: '120 ads' },
      { name: 'Beakers', icon: '🧪', adsCount: '95 ads' }
    ]
  },
  {
    id: 9,
    name: 'Clothing',
    icon: '👕',
    adsCount: '1.5K listings',
    items: [
      { name: 'T-Shirts', icon: '👕', adsCount: '450 ads' },
      { name: 'Polo Shirts', icon: '👕', adsCount: '180 ads' },
      { name: 'Formal Shirts', icon: '👔', adsCount: '120 ads' },
      { name: 'Jeans', icon: '👖', adsCount: '310 ads' },
      { name: 'Trousers', icon: '👖', adsCount: '140 ads' },
      { name: 'Jackets', icon: '🧥', adsCount: '210 ads' },
      { name: 'Hoodies', icon: '🧥', adsCount: '280 ads' },
      { name: 'Sweaters', icon: '🧥', adsCount: '130 ads' },
      { name: 'Sportswear', icon: '👟', adsCount: '95 ads' },
      { name: 'Shoes', icon: '👞', adsCount: '250 ads' },
      { name: 'Sneakers', icon: '👟', adsCount: '420 ads' },
      { name: 'Sandals', icon: '👡', adsCount: '110 ads' },
      { name: 'Slippers', icon: '🥿', adsCount: '150 ads' },
      { name: 'Belt', icon: '🧣', adsCount: '85 ads' },
      { name: 'Cap', icon: '🧢', adsCount: '120 ads' },
      { name: 'Scarf', icon: '🧣', adsCount: '60 ads' }
    ]
  },
  {
    id: 10,
    name: 'Bags',
    icon: '🎒',
    adsCount: '320 listings',
    items: [
      { name: 'Backpack', icon: '🎒', adsCount: '180 ads' },
      { name: 'Laptop Bag', icon: '💼', adsCount: '65 ads' },
      { name: 'School Bag', icon: '🎒', adsCount: '45 ads' },
      { name: 'Travel Bag', icon: '👜', adsCount: '30 ads' },
      { name: 'Handbag', icon: '👜', adsCount: '85 ads' },
      { name: 'Duffel Bag', icon: '👜', adsCount: '40 ads' },
      { name: 'Shoulder Bag', icon: '👜', adsCount: '55 ads' },
      { name: 'Tote Bag', icon: '👜', adsCount: '70 ads' },
      { name: 'Gym Bag', icon: '🎒', adsCount: '25 ads' }
    ]
  },
  {
    id: 11,
    name: 'Sports Equipment',
    icon: '⚽',
    adsCount: '270 listings',
    items: [
      { name: 'Football', icon: '⚽', adsCount: '110 ads' },
      { name: 'Basketball', icon: '🏀', adsCount: '65 ads' },
      { name: 'Volleyball', icon: '🏐', adsCount: '45 ads' },
      { name: 'Handball', icon: '🤾', adsCount: '20 ads' },
      { name: 'Badminton Racket', icon: '🏸', adsCount: '35 ads' },
      { name: 'Shuttlecock', icon: '🏸', adsCount: '80 ads' },
      { name: 'Tennis Racket', icon: '🎾', adsCount: '25 ads' },
      { name: 'Table Tennis Bat', icon: '🏓', adsCount: '40 ads' },
      { name: 'Running Shoes', icon: '👟', adsCount: '120 ads' },
      { name: 'Gym Gloves', icon: '🥊', adsCount: '50 ads' },
      { name: 'Yoga Mat', icon: '🧘', adsCount: '95 ads' },
      { name: 'Skipping Rope', icon: '🤸', adsCount: '60 ads' },
      { name: 'Water Bottle', icon: '🍼', adsCount: '150 ads' },
      { name: 'Sports Bag', icon: '🎒', adsCount: '30 ads' }
    ]
  },
  {
    id: 12,
    name: 'Musical Instruments',
    icon: '🎸',
    adsCount: '150 listings',
    items: [
      { name: 'Acoustic Guitar', icon: '🎸', adsCount: '65 ads' },
      { name: 'Electric Guitar', icon: '🎸', adsCount: '25 ads' },
      { name: 'Keyboard Piano', icon: '🎹', adsCount: '30 ads' },
      { name: 'Violin', icon: '🎻', adsCount: '15 ads' },
      { name: 'Drum Set', icon: '🥁', adsCount: '10 ads' },
      { name: 'Flute', icon: '🎺', adsCount: '20 ads' },
      { name: 'Recorder', icon: '🎺', adsCount: '35 ads' },
      { name: 'Microphone', icon: '🎤', adsCount: '45 ads' },
      { name: 'Guitar Amplifier', icon: '🔊', adsCount: '20 ads' },
      { name: 'Guitar Strings', icon: '🎸', adsCount: '80 ads' },
      { name: 'Music Stand', icon: '🎼', adsCount: '15 ads' },
      { name: 'Headset', icon: '🎧', adsCount: '95 ads' }
    ]
  },
  {
    id: 13,
    name: 'Bicycles & Transportation',
    icon: '🚲',
    adsCount: '110 listings',
    items: [
      { name: 'Bicycle', icon: '🚲', adsCount: '45 ads' },
      { name: 'Mountain Bike', icon: '🚲', adsCount: '25 ads' },
      { name: 'Road Bike', icon: '🚲', adsCount: '15 ads' },
      { name: 'Bicycle Helmet', icon: '🪖', adsCount: '30 ads' },
      { name: 'Bicycle Lock', icon: '🔒', adsCount: '55 ads' },
      { name: 'Bicycle Pump', icon: '🔧', adsCount: '40 ads' },
      { name: 'Bicycle Lights', icon: '💡', adsCount: '35 ads' },
      { name: 'Bicycle Bell', icon: '🔔', adsCount: '60 ads' },
      { name: 'Bicycle Basket', icon: '🧺', adsCount: '15 ads' },
      { name: 'Spare Tire Tube', icon: '🚲', adsCount: '80 ads' }
    ]
  },
  {
    id: 15,
    name: 'Art & Design Materials',
    icon: '🎨',
    adsCount: '230 listings',
    items: [
      { name: 'Sketchbook', icon: '📓', adsCount: '85 ads' },
      { name: 'Drawing Pencil Set', icon: '✏️', adsCount: '110 ads' },
      { name: 'Colored Pencils', icon: '✏️', adsCount: '120 ads' },
      { name: 'Acrylic Paint', icon: '🎨', adsCount: '95 ads' },
      { name: 'Watercolor Paint', icon: '🎨', adsCount: '60 ads' },
      { name: 'Oil Paint', icon: '🎨', adsCount: '40 ads' },
      { name: 'Paint Brushes', icon: '🖌️', adsCount: '130 ads' },
      { name: 'Canvas', icon: '🖼️', adsCount: '75 ads' },
      { name: 'Palette', icon: '🎨', adsCount: '50 ads' },
      { name: 'Markers', icon: '🖊️', adsCount: '95 ads' },
      { name: 'Charcoal Pencils', icon: '✏️', adsCount: '40 ads' },
      { name: 'Easel', icon: '🖼️', adsCount: '20 ads' }
    ]
  },
  {
    id: 16,
    name: 'Graduation Items',
    icon: '🎓',
    adsCount: '450 listings',
    items: [
      { name: 'Graduation Gown', icon: '🎓', adsCount: '180 ads' },
      { name: 'Graduation Cap', icon: '🎓', adsCount: '140 ads' },
      { name: 'Academic Hood', icon: '🎓', adsCount: '65 ads' },
      { name: 'Graduation Shoes', icon: '👞', adsCount: '80 ads' },
      { name: 'Graduation Sash', icon: '🧣', adsCount: '95 ads' },
      { name: 'Graduation Frame', icon: '🖼️', adsCount: '110 ads' },
      { name: 'Certificate Folder', icon: '📁', adsCount: '50 ads' },
      { name: 'Graduation Decorations', icon: '🎈', adsCount: '130 ads' },
      { name: 'Flower Bouquet', icon: '💐', adsCount: '220 ads' }
    ]
  },
  {
    id: 17,
    name: 'Project Materials',
    icon: '🛠️',
    adsCount: '620 listings',
    items: [
      { name: 'Printed Thesis', icon: '📄', adsCount: '150 ads' },
      { name: 'Spiral Binding', icon: '🌀', adsCount: '310 ads' },
      { name: 'Hard Cover Binding', icon: '📖', adsCount: '180 ads' },
      { name: 'Project Report', icon: '📄', adsCount: '115 ads' },
      { name: 'Presentation Pointer', icon: '🔦', adsCount: '45 ads' },
      { name: 'Poster Printing', icon: '📄', adsCount: '90 ads' },
      { name: 'Electronic Components', icon: '🔌', adsCount: '420 ads' },
      { name: 'Arduino Kit', icon: '🔧', adsCount: '240 ads' },
      { name: 'Raspberry Pi Kit', icon: '🍓', adsCount: '80 ads' },
      { name: 'Sensors', icon: '📡', adsCount: '310 ads' },
      { name: 'Breadboard', icon: '🧱', adsCount: '180 ads' },
      { name: 'Jumper Wires', icon: '🔌', adsCount: '250 ads' },
      { name: 'Prototype Board', icon: '🧩', adsCount: '65 ads' }
    ]
  },
  {
    id: 18,
    name: 'Health & Personal Care',
    icon: '🧼',
    adsCount: '580 listings',
    items: [
      { name: 'Face Mask', icon: '😷', adsCount: '180 ads' },
      { name: 'Hand Sanitizer', icon: '🧴', adsCount: '220 ads' },
      { name: 'First Aid Kit', icon: '🩹', adsCount: '50 ads' },
      { name: 'Thermometer', icon: '🌡️', adsCount: '35 ads' },
      { name: 'Water Bottle', icon: '🍼', adsCount: '410 ads' },
      { name: 'Water Flask', icon: '🍼', adsCount: '130 ads' },
      { name: 'Umbrella', icon: '🌂', adsCount: '210 ads' },
      { name: 'Tissue Paper', icon: '🧻', adsCount: '350 ads' },
      { name: 'Toothbrush', icon: '🪥', adsCount: '140 ads' },
      { name: 'Toothpaste', icon: '🧴', adsCount: '180 ads' },
      { name: 'Soap', icon: '🧼', adsCount: '290 ads' },
      { name: 'Shampoo', icon: '🧴', adsCount: '115 ads' }
    ]
  },
  {
    id: 19,
    name: 'Miscellaneous',
    icon: '📦',
    adsCount: '1.1K listings',
    items: [
      { name: 'Alarm Clock', icon: '⏰', adsCount: '140 ads' },
      { name: 'Wall Clock', icon: '🕰️', adsCount: '65 ads' },
      { name: 'Flashlight', icon: '🔦', adsCount: '110 ads' },
      { name: 'Extension Cable', icon: '🔌', adsCount: '340 ads' },
      { name: 'Power Strip', icon: '🔌', adsCount: '210 ads' },
      { name: 'Tool Kit', icon: '🛠️', adsCount: '80 ads' },
      { name: 'Screwdriver Set', icon: '🛠️', adsCount: '115 ads' },
      { name: 'Tape', icon: '🩹', adsCount: '240 ads' },
      { name: 'Glue Gun', icon: '🔫', adsCount: '95 ads' },
      { name: 'Storage Box', icon: '📦', adsCount: '310 ads' },
      { name: 'Laundry Basket', icon: '🧺', adsCount: '180 ads' },
      { name: 'Clothes Hangers', icon: '👔', adsCount: '450 ads' },
      { name: 'Mirror', icon: '🪞', adsCount: '120 ads' },
      { name: 'Desk Lamp', icon: '💡', adsCount: '290 ads' },
      { name: 'Calendar', icon: '📅', adsCount: '80 ads' },
      { name: 'Whiteboard', icon: '📋', adsCount: '115 ads' },
      { name: 'Marker Board', icon: '📋', adsCount: '70 ads' },
      { name: 'Portable Fan', icon: '🌀', adsCount: '135 ads' }
    ]
  }
];

function HomeView({ onAction, user }) {
  const [categories, setCategories] = useState(defaultCategories);
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hoveredCategoryId, setHoveredCategoryId] = useState(null);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchedTitle, setSearchedTitle] = useState('All Products');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const visibleCategories = showAllCategories ? categories : categories.slice(0, 8);

  const handlePrevBanner = () => {
    setCurrentImageIndex((prevIndex) => (prevIndex - 1 + bannerImages.length) % bannerImages.length);
  };

  const handleNextBanner = () => {
    setCurrentImageIndex((prevIndex) => (prevIndex + 1) % bannerImages.length);
  };

  useEffect(() => {
    const intervalId = setInterval(() => {
      setCurrentImageIndex((prevIndex) => (prevIndex + 1) % bannerImages.length);
    }, 5000);

    return () => clearInterval(intervalId);
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/api/categories');
      if (!response.ok) {
        throw new Error('Failed to load categories');
      }
      const data = await response.json();
      const normalizedCategories = (Array.isArray(data) ? data : []).map((category) => ({
        ...category,
        items: Array.isArray(category.sub_categories)
          ? category.sub_categories.map((subCategory) => ({
            name: subCategory.name,
            icon: subCategory.icon || '📦',
            adsCount: subCategory.adsCount || `${subCategory.count || 0} ads`,
          }))
          : Array.isArray(category.items) ? category.items : [],
      }));
      setCategories(normalizedCategories.length ? normalizedCategories : defaultCategories);
    } catch (error) {
      console.error('Category fetch error:', error);
      setCategories(defaultCategories);
    }
  };

  const fetchProducts = async ({ search, category, subcategory, department } = {}) => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (category) params.set('category', category);
      if (subcategory) params.set('subcategory', subcategory);
      if (department) params.set('department', department);

      const url = params.toString()
        ? `http://127.0.0.1:8000/api/products?${params.toString()}`
        : 'http://127.0.0.1:8000/api/products';
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to load products');
      }
      const data = await response.json();
      setSearchResults(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Product fetch error:', error);
      setSearchResults([]);
    }
  };

  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      const department = user?.department || user?.college || user?.departmentName || '';
      await Promise.all([
        fetchCategories(),
        fetchProducts({ department: department || undefined }),
      ]);
      setLoading(false);
    };
    loadInitialData();
  }, [user?.department, user?.college, user?.departmentName]);

  const handleSearch = async (e) => {
    e?.preventDefault();
    const trimmedSearch = searchQuery.trim();
    const department = user?.department || user?.college || user?.departmentName || '';
    if (!trimmedSearch) {
      await fetchProducts({ department: department || undefined });
      setSearchedTitle('All Products');
      return;
    }
    await fetchProducts({ search: trimmedSearch, department: department || undefined });
    setSearchedTitle(`Results for "${trimmedSearch}"`);
  };

  const handleCategoryClick = async (categoryName) => {
    setSearchQuery('');
    const department = user?.department || user?.college || user?.departmentName || '';
    await fetchProducts({ category: categoryName, department: department || undefined });
    setSearchedTitle(categoryName);
    setHoveredCategoryId(null);
  };

  const handleSubCategoryClick = async (subCategoryName, categoryName) => {
    setSearchQuery(subCategoryName);
    const department = user?.department || user?.college || user?.departmentName || '';
    await fetchProducts({ subcategory: subCategoryName, department: department || undefined });
    setSearchedTitle(`${categoryName} > ${subCategoryName}`);
    setHoveredCategoryId(null);
  };

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="rounded-[28px] bg-white border border-slate-200 p-12 text-center text-slate-600 shadow-md haight=500">
          <p className="text-lg font-semibold text-slate-900">Loading marketplace data…</p>
          <p className="mt-2 text-sm">Please wait while categories and products are loaded.</p>
        </div>
      ) : selectedProduct ? (
        <ProductDetails
          product={selectedProduct}
          user={user}
          onBack={() => setSelectedProduct(null)}
          onStartChat={() => {
            console.log('Start chat with seller', selectedProduct);
          }}
        />
      ) : (
        <div className="space-y-6 pt-20">
          <section className="group w-screen relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] rounded-none border-b border-slate-200/40 overflow-hidden shadow-md text-center text-slate-100 h-[600px]">
            {bannerImages.map((src, index) => (
              <img
                key={index}
                src={src}
                alt={`Campus banner ${index + 1}`}
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out z-0 ${currentImageIndex === index ? 'opacity-100' : 'opacity-0'}`}
              />
            ))}
            <button
              type="button"
              onClick={handlePrevBanner}
              className="absolute left-6 top-1/2 -translate-y-1/2 z-30 rounded-full bg-black/30 hover:bg-black/50 text-white p-3.5"
              aria-label="Previous banner"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                <path fillRule="evenodd" d="M12.707 15.707a1 1 0 01-1.414 0L6.586 11l4.707-4.707a1 1 0 011.414 1.414L9.414 11l3.293 3.293a1 1 0 010 1.414z" clipRule="evenodd" />
              </svg>
            </button>
            <button
              type="button"
              onClick={handleNextBanner}
              className="absolute right-6 top-1/2 -translate-y-1/2 z-30 rounded-full bg-black/30 hover:bg-black/50 text-white p-3.5"
              aria-label="Next banner"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                <path fillRule="evenodd" d="M7.293 4.293a1 1 0 011.414 0L13.414 9l-4.707 4.707a1 1 0 01-1.414-1.414L10.586 9 7.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
            <div className="relative z-20">
              <h2 className="text-3xl font-bold text-white">Find What You Need on Campus</h2>
              <p className="mt-2 text-slate-200">Browse peer listings or search specific academic items instantly.</p>
            </div>
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex gap-2 justify-center">
              {bannerImages.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setCurrentImageIndex(index)}
                  aria-label={`Show banner ${index + 1}`}
                  className={currentImageIndex === index ? 'w-6 h-2.5 rounded-full bg-white' : 'w-2.5 h-2.5 rounded-full bg-white/40 hover:bg-white/70'}
                />
              ))}
            </div>
          </section>

          <div className="mx-auto w-full max-w-3xl">
            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3 p-2 rounded-full bg-white border border-slate-200 shadow-md max-w-3xl mx-auto w-full">
              <input
                type="text"
                placeholder="Search books, laptops, lab coats, calculators..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-100 rounded-full px-6 py-3.5 text-slate-900 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 transition"
              />
              <button
                type="submit"
                className="rounded-full bg-emerald-500 px-8 py-3.5 font-semibold text-white hover:bg-emerald-600 transition shadow-md whitespace-nowrap"
              >
                Search Materials
              </button>
            </form>
          </div>

          <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
            <aside className="lg:sticky lg:top-[88px] z-30 h-fit lg:overflow-visible" onMouseLeave={() => setHoveredCategoryId(null)}>
              <div className="rounded-[24px] border border-slate-200 bg-white shadow-sm min-h-[500px]">
                <h3 className="m-4 text-md font-bold text-slate-900 border-b pb-2">Directory</h3>
                <ul className="divide-y divide-slate-100">
                  {visibleCategories.map((cat) => (
                    <li
                      key={cat.id}
                      onMouseEnter={() => setHoveredCategoryId(cat.id)}
                      className="group relative"
                    >
                      <button
                        onClick={() => handleCategoryClick(cat.name)}
                        className="w-full flex items-center justify-between px-4 py-3.5 text-left text-sm text-slate-700 hover:bg-slate-50 hover:text-emerald-600 transition first:rounded-t-[24px] last:rounded-b-[24px]"
                      >
                        <span className="flex items-center gap-3">
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-xl border border-slate-100 group-hover:bg-emerald-50 transition">
                            {cat.icon}
                          </span>
                          <span className="flex flex-col min-w-0">
                            <span className="font-semibold text-slate-800 truncate group-hover:text-emerald-600">{cat.name}</span>
                            <span className="text-[11px] text-slate-400 mt-0.5">{cat.adsCount}</span>
                          </span>
                        </span>
                        <span className="text-slate-400 group-hover:translate-x-1 transition-transform">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </span>
                      </button>

                      {hoveredCategoryId === cat.id && (
                        <div
                          className="absolute left-full top-0 ml-2 w-80 rounded-[24px] border border-slate-200 bg-white p-5 shadow-2xl transition duration-150 animate-fade-in z-40"
                          onMouseEnter={() => setHoveredCategoryId(cat.id)}
                        >
                          <h4 className="mb-3 text-sm font-bold text-slate-900 border-b pb-1.5 flex items-center gap-2">
                            <span>{cat.icon}</span> {cat.name}
                          </h4>
                          <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto pr-1">
                            {cat.items?.map((subItem) => (
                              <button
                                key={subItem.name}
                                onClick={() => handleSubCategoryClick(subItem.name, cat.name)}
                                className="w-full flex items-center justify-between py-2.5 text-left hover:bg-slate-50 hover:text-emerald-600 transition group/sub"
                              >
                                <span className="flex items-center gap-2.5">
                                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-md border border-slate-100 group-hover/sub:bg-emerald-50 transition">
                                    {subItem.icon}
                                  </span>
                                  <span className="flex flex-col min-w-0">
                                    <span className="text-xs font-semibold text-slate-700 truncate group-hover/sub:text-emerald-600">{subItem.name}</span>
                                    <span className="text-[10px] text-slate-400 mt-0.5">{subItem.adsCount}</span>
                                  </span>
                                </span>
                                <span className="text-slate-300 group-hover/sub:translate-x-0.5 transition-transform">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
                <div className="border-t border-slate-100 px-4 py-4">
                  <button
                    type="button"
                    onClick={() => setShowAllCategories((prev) => !prev)}
                    className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition"
                  >
                    {showAllCategories ? (
                      <span className="flex items-center justify-center gap-2">Show Less <span></span></span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">Show More <span></span></span>
                    )}
                  </button>
                </div>
              </div>
            </aside>

            <div>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900">{searchedTitle}</h3>
                <span className="text-sm text-slate-500">{searchResults.length} items found</span>
              </div>

              {searchResults.length === 0 ? (
                <div className="rounded-[24px] border border-slate-200 bg-white p-12 text-center text-slate-500">
                  <span className="text-4xl">🔍</span>
                  <p className="mt-3 text-lg font-semibold">No products found matching that query.</p>
                  <p className="text-sm text-slate-400 mt-1">Try selecting another subcategory from the sidebar.</p>
                </div>
              ) : (
                <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                  {searchResults.map((product, idx) => (
                    <article key={idx} className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm hover:shadow-md transition flex flex-col justify-between">
                      <div>
                        <img src={product.image} alt={product.title} className="h-44 w-full object-cover" />
                        <div className="p-4">
                          <div className="flex justify-between items-start gap-1">
                            <p className="text-xs font-semibold text-emerald-600">{product.category}</p>
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{product.subcategory}</span>
                          </div>
                          <h4 className="mt-1 text-md font-semibold text-slate-900 truncate">{product.title}</h4>
                          <p className="mt-1.5 text-xs text-slate-500 line-clamp-2">{product.description}</p>
                        </div>
                      </div>
                      <div className="p-4 pt-0">
                        <div className="flex items-center justify-between border-t border-slate-50 pt-3">
                          <span className="text-lg font-bold text-slate-900">{product.price}</span>
                          <button
                            onClick={() => {
                              setSelectedProduct(product);
                              onAction && onAction(product);
                            }}
                            className="rounded-full bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 transition"
                          >
                            View Details
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default HomeView;
