import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { X, Package, Tag, DollarSign, Hash, Warehouse, AlertTriangle, Edit, Loader2, Save } from 'lucide-react';

interface ProductFormData {
    name: string;
    category: string;
    price: number;
    quantity: number;
    warehouse_location: string;
    stock_alert_level: number;
}

interface EditProductPopupProps {
    isOpen: boolean;
    onClose: () => void;
    productId: string | null;
    onProductUpdated: (productId: string, updatedProduct: ProductFormData) => void;
}

const FormField = ({ 
    label, 
    icon, 
    children, 
    required = false 
}: { 
    label: string; 
    icon: React.ReactNode; 
    children: React.ReactNode; 
    required?: boolean;
}) => (
    <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <span className="w-4 h-4 text-slate-500">{icon}</span>
            {label}
            {required && <span className="text-red-500">*</span>}
        </label>
        {children}
    </div>
);

const EditProductPopup: React.FC<EditProductPopupProps> = ({ isOpen, onClose, productId, onProductUpdated }) => {
    const [formData, setFormData] = useState<ProductFormData>({
        name: '',
        category: '',
        price: 0,
        quantity: 0,
        warehouse_location: '',
        stock_alert_level: 0
    });
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const fetchProductDetails = useCallback(async () => {
        if (!productId) return;

        try {
            setLoading(true);
            const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/inventory/${productId}`);
            setFormData(response.data);
            setErrors({});
        } catch (err) {
            console.error('Error fetching product details:', err);
            setErrors({ fetch: 'Failed to load product details. Please try again.' });
        } finally {
            setLoading(false);
        }
    }, [productId]);

    useEffect(() => {
        if (isOpen && productId) {
            fetchProductDetails();
        }
    }, [isOpen, productId, fetchProductDetails]);

    const validateForm = () => {
        const newErrors: Record<string, string> = {};

        if (!formData.name.trim()) {
            newErrors.name = 'Product name is required';
        }
        if (!formData.category.trim()) {
            newErrors.category = 'Category is required';
        }
        if (formData.price <= 0) {
            newErrors.price = 'Price must be greater than 0';
        }
        if (formData.quantity < 0) {
            newErrors.quantity = 'Quantity cannot be negative';
        }
        if (!formData.warehouse_location.trim()) {
            newErrors.warehouse_location = 'Warehouse location is required';
        }
        if (formData.stock_alert_level < 0) {
            newErrors.stock_alert_level = 'Stock alert level cannot be negative';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        const newValue = name === 'price' || name === 'quantity' || name === 'stock_alert_level'
            ? value === '' ? 0 : parseFloat(value)
            : value;

        setFormData({
            ...formData,
            [name]: newValue
        });

        // Clear error when user starts typing
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: '' }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!productId) return;

        if (!validateForm()) {
            return;
        }

        setIsSubmitting(true);
        try {
            await axios.put(`${process.env.NEXT_PUBLIC_API_URL}/update-inventory/${productId}`, formData);
            onProductUpdated(productId, formData);
            onClose();
        } catch (err) {
            console.error('Error updating product:', err);
            setErrors({ submit: 'Failed to update product. Please try again.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        setFormData({
            name: '',
            category: '',
            price: 0,
            quantity: 0,
            warehouse_location: '',
            stock_alert_level: 0
        });
        setErrors({});
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                                <Edit className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold">Edit Product</h2>
                                <p className="text-blue-100">Update product information in your inventory</p>
                            </div>
                        </div>
                        <button 
                            onClick={handleClose} 
                            className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center mb-4">
                                <Loader2 className="w-8 h-8 text-white animate-spin" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-900 mb-2">Loading Product Details</h3>
                            <p className="text-slate-600">Please wait while we fetch the product information...</p>
                        </div>
                    ) : errors.fetch ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                                <AlertTriangle className="w-8 h-8 text-red-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-900 mb-2">Error Loading Product</h3>
                            <p className="text-slate-600 mb-4">{errors.fetch}</p>
                            <button
                                onClick={fetchProductDetails}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                Try Again
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Product Name */}
                                <FormField 
                                    label="Product Name" 
                                    icon={<Package />} 
                                    required
                                >
                                    <input
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                                            errors.name ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'
                                        }`}
                                        placeholder="Enter product name"
                                    />
                                    {errors.name && (
                                        <p className="text-sm text-red-600 flex items-center gap-1">
                                            <AlertTriangle className="w-3 h-3" />
                                            {errors.name}
                                        </p>
                                    )}
                                </FormField>

                                {/* Category */}
                                <FormField 
                                    label="Category" 
                                    icon={<Tag />} 
                                    required
                                >
                                    <input
                                        type="text"
                                        name="category"
                                        value={formData.category}
                                        onChange={handleChange}
                                        className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                                            errors.category ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'
                                        }`}
                                        placeholder="Enter product category"
                                    />
                                    {errors.category && (
                                        <p className="text-sm text-red-600 flex items-center gap-1">
                                            <AlertTriangle className="w-3 h-3" />
                                            {errors.category}
                                        </p>
                                    )}
                                </FormField>

                                {/* Price */}
                                <FormField 
                                    label="Price (₹)" 
                                    icon={<DollarSign />} 
                                    required
                                >
                                    <input
                                        type="number"
                                        name="price"
                                        value={formData.price}
                                        onChange={handleChange}
                                        className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                                            errors.price ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'
                                        }`}
                                        min="0"
                                        step="0.01"
                                        placeholder="0.00"
                                    />
                                    {errors.price && (
                                        <p className="text-sm text-red-600 flex items-center gap-1">
                                            <AlertTriangle className="w-3 h-3" />
                                            {errors.price}
                                        </p>
                                    )}
                                </FormField>

                                {/* Quantity */}
                                <FormField 
                                    label="Quantity" 
                                    icon={<Hash />} 
                                    required
                                >
                                    <input
                                        type="number"
                                        name="quantity"
                                        value={formData.quantity}
                                        onChange={handleChange}
                                        className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                                            errors.quantity ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'
                                        }`}
                                        min="0"
                                        placeholder="0"
                                    />
                                    {errors.quantity && (
                                        <p className="text-sm text-red-600 flex items-center gap-1">
                                            <AlertTriangle className="w-3 h-3" />
                                            {errors.quantity}
                                        </p>
                                    )}
                                </FormField>

                                {/* Warehouse Location */}
                                <FormField 
                                    label="Warehouse Location" 
                                    icon={<Warehouse />} 
                                    required
                                >
                                    <input
                                        type="text"
                                        name="warehouse_location"
                                        value={formData.warehouse_location}
                                        onChange={handleChange}
                                        className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                                            errors.warehouse_location ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'
                                        }`}
                                        placeholder="Enter warehouse location"
                                    />
                                    {errors.warehouse_location && (
                                        <p className="text-sm text-red-600 flex items-center gap-1">
                                            <AlertTriangle className="w-3 h-3" />
                                            {errors.warehouse_location}
                                        </p>
                                    )}
                                </FormField>

                                {/* Stock Alert Level */}
                                <FormField 
                                    label="Stock Alert Level" 
                                    icon={<AlertTriangle />} 
                                    required
                                >
                                    <input
                                        type="number"
                                        name="stock_alert_level"
                                        value={formData.stock_alert_level}
                                        onChange={handleChange}
                                        className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                                            errors.stock_alert_level ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'
                                        }`}
                                        min="0"
                                        placeholder="0"
                                    />
                                    {errors.stock_alert_level && (
                                        <p className="text-sm text-red-600 flex items-center gap-1">
                                            <AlertTriangle className="w-3 h-3" />
                                            {errors.stock_alert_level}
                                        </p>
                                    )}
                                </FormField>
                            </div>

                            {errors.submit && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                    <p className="text-sm text-red-600 flex items-center gap-2">
                                        <AlertTriangle className="w-4 h-4" />
                                        {errors.submit}
                                    </p>
                                </div>
                            )}
                        </form>
                    )}
                </div>

                {/* Footer */}
                {!loading && !errors.fetch && (
                    <div className="border-t border-slate-200 p-6 bg-slate-50">
                        <div className="flex gap-3 justify-end">
                            <button
                                type="button"
                                onClick={handleClose}
                                className="px-6 py-3 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                                disabled={isSubmitting}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Updating Product...
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-4 h-4" />
                                        Update Product
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default EditProductPopup;