import React, { useState } from 'react';

const PostProductForm = () => {
  const [formData, setFormData] = useState({
    title: '',
    category: '',
    location: '',
    videoLink: '',
    photos: []
  });

  const categories = [
    'Electronics', 'Books & Textbooks', 'Fashion', 'Furniture',
    'Sports & Outdoors', 'Home & Kitchen', 'Beauty & Health',
    'Toys & Games', 'Movies & Music', 'Art & Crafts',
    'Services', 'Jobs', 'Real Estate', 'Vehicles',
    'Food & Beverages', 'Other'
  ];

  const universities = [
    'Addis Ababa University',
    'Adama University',
    'Bahir Dar University',
    'Dire Dawa University',
    'Haramaya University',
    'Hawassa University',
    'Jimma University',
    'Mekelle University',
    'Wolaita Sodo University',
    'Wollega University',
    'Debre Birhan University',
    'Debre Markos University',
    'Arba Minch University',
    'Samara University',
    'Assosa University',
    'Kombolcha University'
  ];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePhotoUpload = (e) => {
    const files = Array.from(e.target.files);
    setFormData(prev => ({
      ...prev,
      photos: [...prev.photos, ...files]
    }));
  };

  const handleClear = () => {
    setFormData({
      title: '',
      category: '',
      location: '',
      videoLink: '',
      photos: []
    });
  };

  const isFormValid = formData.title.trim() && formData.category && formData.location && formData.photos.length > 0;

  return (
    <div className="min-h-screen bg-sky-50 p-6 flex items-center justify-center">
      <div className="w-full max-w-2xl bg-white rounded-[28px] shadow-lg p-8 border border-slate-100">
        
        {/* Header with Clear Button */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Post ad</h1>
          <button
            onClick={handleClear}
            className="px-6 py-2 bg-red-50 text-red-600 font-semibold rounded-full hover:bg-red-100 transition-colors"
          >
            Clear
          </button>
        </div>

        {/* Form Content */}
        <form className="space-y-6">
          
          {/* Title Input */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="Enter product title"
              className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-400 focus:bg-white transition"
            />
          </div>

          {/* Category Dropdown */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Category <span className="text-red-500">*</span>
            </label>
            <select
              name="category"
              value={formData.category}
              onChange={handleInputChange}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 focus:outline-none focus:border-sky-400 focus:bg-white transition appearance-none cursor-pointer"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23334155' d='M10.293 3.293L6 7.586 1.707 3.293A1 1 0 00.293 4.707l5 5a1 1 0 001.414 0l5-5a1 1 0 10-1.414-1.414z'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 12px center',
                paddingRight: '36px'
              }}
            >
              <option value="">Select Category</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Location Dropdown */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Select Location <span className="text-red-500">*</span>
            </label>
            <select
              name="location"
              value={formData.location}
              onChange={handleInputChange}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 focus:outline-none focus:border-sky-400 focus:bg-white transition appearance-none cursor-pointer"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23334155' d='M10.293 3.293L6 7.586 1.707 3.293A1 1 0 00.293 4.707l5 5a1 1 0 001.414 0l5-5a1 1 0 10-1.414-1.414z'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 12px center',
                paddingRight: '36px'
              }}
            >
              <option value="">Select University</option>
              {universities.map(uni => (
                <option key={uni} value={uni}>{uni}</option>
              ))}
            </select>
          </div>

          {/* Photo Uploader */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Add at least 1 photo</h3>
            <p className="text-sm text-slate-600 mb-4">
              First picture is the title picture. You can change the order of photos: just grab your photos and drag.
            </p>
            
            <div className="flex gap-4 items-center mb-4">
              <label className="flex items-center justify-center h-16 w-16 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100 cursor-pointer hover:bg-emerald-100 transition text-3xl">
                +
                <input
                  type="file"
                  multiple
                  accept=".jpg,.jpeg,.png"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>

              {/* Photo Preview */}
              <div className="flex gap-2 flex-wrap">
                {formData.photos.map((photo, idx) => (
                  <div key={idx} className="relative h-16 w-16 rounded-lg overflow-hidden border border-slate-200">
                    <img 
                      src={URL.createObjectURL(photo)} 
                      alt={`Preview ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          photos: prev.photos.filter((_, i) => i !== idx)
                        }));
                      }}
                      className="absolute top-0 right-0 bg-red-500 text-white w-5 h-5 flex items-center justify-center text-xs rounded-bl"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-xs text-slate-500">Supported formats are *.jpg and *.png</p>
          </div>

          {/* Video Link */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Link to Youtube or Facebook video
            </label>
            <input
              type="url"
              name="videoLink"
              value={formData.videoLink}
              onChange={handleInputChange}
              placeholder="https://youtube.com/... or https://facebook.com/..."
              className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-400 focus:bg-white transition"
            />
          </div>

          {/* Submit Button */}
          <div className="pt-6">
            <button
              type="button"
              disabled={!isFormValid}
              className={`w-full py-3 font-semibold rounded-full transition-colors ${
                isFormValid
                  ? 'bg-emerald-500 text-white hover:bg-emerald-600 cursor-pointer'
                  : 'bg-slate-200 text-slate-500 cursor-not-allowed'
              }`}
            >
              Next
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default PostProductForm;
