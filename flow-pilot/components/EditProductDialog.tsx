import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { X } from 'lucide-react';

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

    const fetchProductDetails = useCallback(async () => {
        if (!productId) return;

        try {
            setLoading(true);
            const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/get-inventory/${productId}`);
            setFormData(response.data);
        } catch (err) {
            console.error('Error fetching product details:', err);
        } finally {
            setLoading(false);
        }
    }, [productId]);

    useEffect(() => {
        if (isOpen && productId) {
            fetchProductDetails();
        }
    }, [isOpen, productId, fetchProductDetails]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData({
            ...formData,
            [name]: name === 'price' || name === 'quantity' || name === 'stock_alert_level'
                ? parseFloat(value)
                : value
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!productId) return;

        try {
            await axios.put(`${process.env.NEXT_PUBLIC_API_URL}/update-inventory/${productId}`, formData);
            onProductUpdated(productId, formData);
            onClose();
        } catch (err) {
            console.error('Error updating product:', err);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto overflow-x-hidden">
            <div className="bg-[#1A1A1A] p-6 rounded-lg w-full max-w-md mx-auto my-8">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-white">Edit Product</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                        <X size={24} />
                    </button>
                </div>

                {loading ? (
                    <div className="flex justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#00E676]"></div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-gray-300 mb-1">Product Name</label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 bg-[#252525] border border-[#333] rounded-lg text-white"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-gray-300 mb-1">Category</label>
                                <input
                                    type="text"
                                    name="category"
                                    value={formData.category}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 bg-[#252525] border border-[#333] rounded-lg text-white"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-gray-300 mb-1">Price</label>
                                <input
                                    type="number"
                                    name="price"
                                    value={formData.price}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 bg-[#252525] border border-[#333] rounded-lg text-white"
                                    min="0"
                                    step="0.01"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-gray-300 mb-1">Quantity</label>
                                <input
                                    type="number"
                                    name="quantity"
                                    value={formData.quantity}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 bg-[#252525] border border-[#333] rounded-lg text-white"
                                    min="0"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-gray-300 mb-1">Warehouse Location</label>
                                <input
                                    type="text"
                                    name="warehouse_location"
                                    value={formData.warehouse_location}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 bg-[#252525] border border-[#333] rounded-lg text-white"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-gray-300 mb-1">Stock Alert Level</label>
                                <input
                                    type="number"
                                    name="stock_alert_level"
                                    value={formData.stock_alert_level}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 bg-[#252525] border border-[#333] rounded-lg text-white"
                                    min="0"
                                    required
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 px-4 py-2 bg-[#333] text-white rounded-lg hover:bg-[#444]"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="flex-1 px-4 py-2 bg-[#00E676] text-black rounded-lg hover:bg-[#00C864]"
                            >
                                Update Product
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default EditProductPopup;