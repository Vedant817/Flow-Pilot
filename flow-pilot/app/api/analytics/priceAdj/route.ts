import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { Inventory } from "@/models/Inventory";
import { Order } from "@/models/Order";

interface PricingAnalysis {
    product: string;
    currentPrice: number;
    recommendedPrice: number;
    reason: string;
    confidence: number;
    potentialImpact: string;
    urgency: 'high' | 'medium' | 'low';
}

interface ProductOrderData {
    name: string;
    totalOrdered: number;
    averageOrderQuantity: number;
    lastOrderDate: string;
    orderFrequency: number;
}

export async function GET() {
    try {
        await dbConnect();

        const inventory = await Inventory.find({}).lean();
        const orders = await Order.find({}).lean();

        if (!inventory.length) {
            return NextResponse.json({
                "Pricing Suggestions": {
                    pricing_recommendations: []
                }
            });
        }

        const productOrderData: { [key: string]: ProductOrderData } = {};
        const currentDate = new Date();

        orders.forEach(order => {
            if (!order || !order.products) {
                console.warn(`Order missing products array:`, order?._id || 'unknown ID');
                return;
            }

            if (!Array.isArray(order.products)) {
                console.warn(`Order products is not an array:`, order._id);
                return;
            }

            if (order.products.length === 0) {
                console.warn(`Order has empty products array:`, order._id);
                return;
            }

            order.products.forEach((product: { name: string; quantity: number }) => {
                if (!product || !product.name || typeof product.quantity !== 'number') {
                    console.warn(`Invalid product in order ${order._id}:`, product);
                    return;
                }

                const productName = product.name;

                if (!productOrderData[productName]) {
                    productOrderData[productName] = {
                        name: productName,
                        totalOrdered: 0,
                        averageOrderQuantity: 0,
                        lastOrderDate: order.date,
                        orderFrequency: 0
                    };
                }

                productOrderData[productName].totalOrdered += product.quantity;
                productOrderData[productName].orderFrequency += 1;

                const orderDate = new Date(order.date);
                const lastOrderDate = new Date(productOrderData[productName].lastOrderDate);
                if (orderDate > lastOrderDate) {
                    productOrderData[productName].lastOrderDate = order.date;
                }
            });
        });

        Object.keys(productOrderData).forEach(productName => {
            const data = productOrderData[productName];
            data.averageOrderQuantity = data.totalOrdered / data.orderFrequency;
        });

        const recommendations: PricingAnalysis[] = inventory.map(item => {
            const orderData = productOrderData[item.name];
            const stockLevel = item.quantity;
            const stockAlertLevel = item.stock_alert_level;
            const currentPrice = item.price;

            let recommendedPrice = currentPrice;
            let reason = "";
            let confidence = 70;
            let potentialImpact = "";
            let urgency: 'high' | 'medium' | 'low' = 'low';

            const isLowStock = stockLevel <= stockAlertLevel;
            const isCriticalStock = stockLevel <= stockAlertLevel * 0.5;
            const isOverstock = stockLevel > stockAlertLevel * 3;

            const demandMultiplier = orderData ? orderData.orderFrequency / 10 : 0.1;
            const avgOrderQty = orderData ? orderData.averageOrderQuantity : 1;
            const daysSinceLastOrder = orderData ?
                Math.ceil((currentDate.getTime() - new Date(orderData.lastOrderDate).getTime()) / (1000 * 60 * 60 * 24)) :
                365;

            const categoryPremium = getCategoryPremium(item.category);

            if (isCriticalStock && orderData && demandMultiplier > 0.5) {
                const increase = Math.min(15, 5 + (demandMultiplier * 10));
                recommendedPrice = currentPrice * (1 + increase / 100);
                reason = `Critical stock level (${stockLevel} units) with high demand. Price increase to manage demand and improve margins.`;
                confidence = 90;
                urgency = 'high';
                potentialImpact = `Revenue increase: ₹${((recommendedPrice - currentPrice) * avgOrderQty * demandMultiplier).toFixed(0)}/month`;
            } else if (isLowStock && demandMultiplier > 0.3) {
                const increase = Math.min(8, 3 + (demandMultiplier * 5));
                recommendedPrice = currentPrice * (1 + increase / 100);
                reason = `Low stock with steady demand. Moderate price increase to balance supply and demand.`;
                confidence = 80;
                urgency = 'medium';
                potentialImpact = `Revenue increase: ₹${((recommendedPrice - currentPrice) * avgOrderQty * demandMultiplier).toFixed(0)}/month`;
            } else if (isOverstock || daysSinceLastOrder > 60) {
                const decrease = isOverstock ?
                    Math.min(20, 5 + Math.log(stockLevel / stockAlertLevel) * 5) :
                    Math.min(15, daysSinceLastOrder / 10);
                recommendedPrice = currentPrice * (1 - decrease / 100);
                reason = isOverstock ?
                    `Overstocked item (${stockLevel} vs ${stockAlertLevel} alert level). Price reduction to move inventory.` :
                    `No recent orders (${daysSinceLastOrder} days). Competitive pricing to stimulate demand.`;
                confidence = 85;
                urgency = isOverstock ? 'high' : 'medium';
                potentialImpact = `Inventory turnover improvement, reduced holding costs: ₹${(stockLevel * (currentPrice - recommendedPrice) * 0.1).toFixed(0)} saved`;
            } else if (demandMultiplier > 1.0 && stockLevel > stockAlertLevel * 1.5) {
                const increase = Math.min(5, demandMultiplier * 2);
                recommendedPrice = currentPrice * (1 + increase / 100);
                reason = `High demand product with adequate stock. Optimizing price for maximum revenue.`;
                confidence = 75;
                urgency = 'medium';
                potentialImpact = `Revenue optimization: ₹${((recommendedPrice - currentPrice) * avgOrderQty * demandMultiplier).toFixed(0)}/month`;
            } else {
                const adjustment = categoryPremium + (Math.random() - 0.5) * 2;
                recommendedPrice = currentPrice * (1 + adjustment / 100);
                reason = `Stable product. Minor adjustment based on category trends and market positioning.`;
                confidence = 60;
                urgency = 'low';
                potentialImpact = `Marginal impact: ₹${Math.abs((recommendedPrice - currentPrice) * avgOrderQty * 0.5).toFixed(0)}/month`;
            }

            const minPrice = currentPrice * 0.7;
            const maxPrice = currentPrice * 1.25;
            recommendedPrice = Math.max(minPrice, Math.min(maxPrice, recommendedPrice));

            recommendedPrice = Math.round(recommendedPrice / 10) * 10;

            return {
                product: item.name,
                currentPrice: currentPrice,
                recommendedPrice: recommendedPrice,
                reason: reason,
                confidence: confidence,
                potentialImpact: potentialImpact,
                urgency: urgency
            };
        });

        recommendations.sort((a, b) => {
            const urgencyWeight = { high: 3, medium: 2, low: 1 };
            const aWeight = urgencyWeight[a.urgency] * a.confidence;
            const bWeight = urgencyWeight[b.urgency] * b.confidence;
            return bWeight - aWeight;
        });

        const formattedRecommendations = recommendations.map(rec => ({
            Product: rec.product,
            "Old Price": rec.currentPrice,
            "New Price": rec.recommendedPrice,
            Reason: rec.reason,
            Confidence: `${rec.confidence}%`,
            "Potential Impact": rec.potentialImpact,
            Urgency: rec.urgency
        }));

        return NextResponse.json({
            "Pricing Suggestions": {
                pricing_recommendations: formattedRecommendations,
                analysis_date: new Date().toISOString(),
                total_products_analyzed: inventory.length,
                high_priority_adjustments: recommendations.filter(r => r.urgency === 'high').length,
                summary: generatePricingSummary(recommendations)
            }
        });

    } catch (error) {
        console.error("Error in price adjustment analysis:", error);
        return NextResponse.json({
            error: "Failed to generate pricing recommendations",
            details: error instanceof Error ? error.message : "Unknown error"
        }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const { productId, newPrice, applyRecommendation } = await request.json();

        if (!productId || (!newPrice && !applyRecommendation)) {
            return NextResponse.json({
                error: "Missing required fields: productId and (newPrice or applyRecommendation)"
            }, { status: 400 });
        }

        await dbConnect();

        const product = await Inventory.findById(productId);
        if (!product) {
            return NextResponse.json({ error: "Product not found" }, { status: 404 });
        }

        const oldPrice = product.price;
        product.price = newPrice;
        await product.save();

        return NextResponse.json({
            message: "Price updated successfully",
            product: {
                id: product._id,
                name: product.name,
                oldPrice: oldPrice,
                newPrice: newPrice,
                priceChange: newPrice - oldPrice,
                priceChangePercent: ((newPrice - oldPrice) / oldPrice * 100).toFixed(2)
            }
        });

    } catch (error) {
        console.error("Error updating price:", error);
        return NextResponse.json({
            error: "Failed to update price",
            details: error instanceof Error ? error.message : "Unknown error"
        }, { status: 500 });
    }
}

function getCategoryPremium(category: string): number {
    const categoryPremiums: { [key: string]: number } = {
        'electronics': 2,
        'fashion': 1,
        'home': 0.5,
        'books': -0.5,
        'toys': 1.5,
        'sports': 1,
        'beauty': 2.5,
        'automotive': 0,
        'food': -1,
        'health': 3
    };

    return categoryPremiums[category.toLowerCase()] || 0;
}

function generatePricingSummary(recommendations: PricingAnalysis[]): string {
    const totalRecommendations = recommendations.length;
    const priceIncreases = recommendations.filter(r => r.recommendedPrice > r.currentPrice).length;
    const priceDecreases = recommendations.filter(r => r.recommendedPrice < r.currentPrice).length;
    const highUrgency = recommendations.filter(r => r.urgency === 'high').length;

    const avgConfidence = recommendations.reduce((sum, r) => sum + r.confidence, 0) / totalRecommendations;

    return `Analysis of ${totalRecommendations} products: ${priceIncreases} price increases, ${priceDecreases} price decreases recommended. ${highUrgency} high-priority adjustments identified. Average confidence: ${avgConfidence.toFixed(1)}%`;
}