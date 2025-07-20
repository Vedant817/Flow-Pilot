import React, { useState } from 'react';
import axios from 'axios';
import { X, Package, Tag, DollarSign, Hash, Warehouse, AlertTriangle, Plus, Loader2 } from 'lucide-react';

interface ProductFormData {
    name: string;
    category: string;
    price: number;
    quantity: number;
    warehouse_location: string;
    stock_alert_level: number;
}

interface AddProductPopupProps {
    isOpen: boolean;
    onClose: () => void;
    onProductAdded: (newProduct: ProductFormData & { _id: string }) => void;
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

const AddProductPopup: React.FC<AddProductPopupProps> = ({ isOpen, onClose, onProductAdded }: AddProductPopupProps) => {
    const [formData, setFormData] = useState<ProductFormData>({
        name: '',
        category: '',
        price: 0,
        quantity: 0,
        warehouse_location: '',
        stock_alert_level: 0
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

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

        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: '' }));
        }
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        
        if (!validateForm()) {
            return;
        }

        setIsSubmitting(true);
        try {
            const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/inventory`, formData);
            onProductAdded(response.data);
            
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
        } catch (err) {
            console.error('Error adding product:', err);
            setErrors({ submit: 'Failed to add product. Please try again.' });
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
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                                <Plus className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold">Add New Product</h2>
                                <p className="text-blue-100">Create a new product in your inventory</p>
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
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                </div>

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
                            disabled={isSubmitting}
                            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Adding Product...
                                </>
                            ) : (
                                <>
                                    <Plus className="w-4 h-4" />
                                    Add Product
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AddProductPopup;