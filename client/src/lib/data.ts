export interface Product {
    id: string
    name: string
    category: string
    price: number
    quantity: number
    reorderPoint: number
    supplier: string
    lastRestocked: string
}

export interface Customer {
    id: string
    name: string
    email: string
    totalOrders: number
    totalSpent: number
    firstOrder: string
    lastOrder: string
}

export interface Order {
    serialNo: number
    orderId: string
    customerName: string
    customerId: string
    status: "Pending" | "Processing" | "Shipped" | "Delivered" | "Cancelled"
    orderDate: string
    deadlineDate: string
    email: string
    total: number
    items: {
        itemId: string
        name: string
        quantity: number
        price: number
        specification: string
        status: "Filled" | "Cancelled" | "Pending"
    }[]
}

export const products: Product[] = [
    {
        id: "PROD001",
        name: "Premium Laptop",
        category: "Electronics",
        price: 1299.99,
        quantity: 50,
        reorderPoint: 10,
        supplier: "TechCorp",
        lastRestocked: "2024-01-15",
    },
    {
        id: "PROD002",
        name: "Wireless Earbuds",
        category: "Electronics",
        price: 149.99,
        quantity: 200,
        reorderPoint: 30,
        supplier: "AudioTech",
        lastRestocked: "2024-02-01",
    },
    {
        id: "PROD003",
        name: "Smart Watch",
        category: "Electronics",
        price: 299.99,
        quantity: 75,
        reorderPoint: 15,
        supplier: "TechCorp",
        lastRestocked: "2024-01-20",
    },
    {
        id: "PROD004",
        name: "Gaming Console",
        category: "Electronics",
        price: 499.99,
        quantity: 25,
        reorderPoint: 8,
        supplier: "GameTech",
        lastRestocked: "2024-01-10",
    },
    {
        id: "PROD005",
        name: "Coffee Maker",
        category: "Appliances",
        price: 79.99,
        quantity: 100,
        reorderPoint: 20,
        supplier: "HomeGoods",
        lastRestocked: "2024-01-25",
    },
    {
        id: "PROD006",
        name: "Blender",
        category: "Appliances",
        price: 129.99,
        quantity: 60,
        reorderPoint: 12,
        supplier: "HomeGoods",
        lastRestocked: "2024-01-30",
    },
    {
        id: "PROD007",
        name: "Desk Chair",
        category: "Furniture",
        price: 199.99,
        quantity: 40,
        reorderPoint: 10,
        supplier: "FurnishCo",
        lastRestocked: "2024-01-05",
    },
    {
        id: "PROD008",
        name: "Standing Desk",
        category: "Furniture",
        price: 399.99,
        quantity: 30,
        reorderPoint: 8,
        supplier: "FurnishCo",
        lastRestocked: "2024-01-12",
    },
    {
        id: "PROD009",
        name: "Mechanical Keyboard",
        category: "Electronics",
        price: 129.99,
        quantity: 150,
        reorderPoint: 25,
        supplier: "TechCorp",
        lastRestocked: "2024-01-28",
    },
    {
        id: "PROD010",
        name: "4K Monitor",
        category: "Electronics",
        price: 399.99,
        quantity: 45,
        reorderPoint: 10,
        supplier: "TechCorp",
        lastRestocked: "2024-01-18",
    },
]

export const customers: Customer[] = [
    {
        id: "CUST001",
        name: "John Doe",
        email: "john@example.com",
        totalOrders: 15,
        totalSpent: 12500.0,
        firstOrder: "2023-06-15",
        lastOrder: "2024-02-01",
    },
    {
        id: "CUST002",
        name: "Jane Smith",
        email: "jane@example.com",
        totalOrders: 8,
        totalSpent: 4300.0,
        firstOrder: "2023-08-20",
        lastOrder: "2024-01-25",
    },
    {
        id: "CUST003",
        name: "Robert Johnson",
        email: "robert@example.com",
        totalOrders: 20,
        totalSpent: 15800.0,
        firstOrder: "2023-05-10",
        lastOrder: "2024-02-02",
    },
    {
        id: "CUST004",
        name: "Emily Brown",
        email: "emily@example.com",
        totalOrders: 12,
        totalSpent: 8900.0,
        firstOrder: "2023-07-01",
        lastOrder: "2024-01-30",
    },
    {
        id: "CUST005",
        name: "Michael Wilson",
        email: "michael@example.com",
        totalOrders: 25,
        totalSpent: 19500.0,
        firstOrder: "2023-04-15",
        lastOrder: "2024-02-01",
    },
    {
        id: "CUST006",
        name: "Sarah Davis",
        email: "sarah@example.com",
        totalOrders: 6,
        totalSpent: 3200.0,
        firstOrder: "2023-09-05",
        lastOrder: "2024-01-28",
    },
    {
        id: "CUST007",
        name: "David Miller",
        email: "david@example.com",
        totalOrders: 18,
        totalSpent: 14200.0,
        firstOrder: "2023-06-01",
        lastOrder: "2024-02-02",
    },
    {
        id: "CUST008",
        name: "Lisa Anderson",
        email: "lisa@example.com",
        totalOrders: 10,
        totalSpent: 6800.0,
        firstOrder: "2023-08-10",
        lastOrder: "2024-01-29",
    },
    {
        id: "CUST009",
        name: "James Taylor",
        email: "james@example.com",
        totalOrders: 14,
        totalSpent: 11000.0,
        firstOrder: "2023-07-15",
        lastOrder: "2024-02-01",
    },
    {
        id: "CUST010",
        name: "Jennifer White",
        email: "jennifer@example.com",
        totalOrders: 9,
        totalSpent: 5500.0,
        firstOrder: "2023-08-25",
        lastOrder: "2024-01-31",
    },
]

// Generate sample orders for the last 12 months
export const orders: Order[] = Array.from({ length: 500 }, (_, i) => {
    const customer = customers[Math.floor(Math.random() * customers.length)]
    const date = new Date()
    date.setDate(date.getDate() - Math.floor(Math.random() * 365)) // Orders from last 12 months
    const orderDate = date.toISOString().split("T")[0]

    const deadlineDate = new Date(date)
    deadlineDate.setDate(deadlineDate.getDate() + 7)

    const items = Array.from({ length: Math.floor(Math.random() * 3) + 1 }, () => {
        const product = products[Math.floor(Math.random() * products.length)]
        const quantity = Math.floor(Math.random() * 3) + 1
        return {
            itemId: product.id,
            name: product.name,
            quantity,
            price: product.price,
            specification: "Standard",
            status: Math.random() > 0.8 ? "Pending" : ("Filled" as const),
        }
    })

    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0)

    return {
        serialNo: i + 1,
        orderId: `ORD${String(i + 1).padStart(3, "0")}`,
        customerName: customer.name,
        customerId: customer.id,
        status: ["Pending", "Processing", "Shipped", "Delivered"][Math.floor(Math.random() * 4)] as Order["status"],
        orderDate,
        deadlineDate: deadlineDate.toISOString().split("T")[0],
        email: customer.email,
        total,
        items,
    }
})