using FreshMarket.Api.Domain;
using FreshMarket.Api.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace FreshMarket.Api.Data;

public static class SeedData
{
    private record CatalogItem(string Name, string Image, string Category, ProductUnit Unit, decimal Price, decimal Step, string Description);

    private static readonly CatalogItem[] Catalog =
    [
        new("Green Chilli", "green-chilli", "green", ProductUnit.Kg, 40, 0.1m, "Glossy, fiery green chillies picked this morning. Perfect for tadka, chutneys and pickles."),
        new("Tomato", "tomato", "seasonal", ProductUnit.Kg, 30, 0.25m, "Vine-ripened country tomatoes — juicy, tangy and deep red. Ideal for curries, rasam and salads."),
        new("Onion", "onion", "root", ProductUnit.Kg, 45, 0.25m, "Firm Nashik red onions with a sharp, sweet bite. The base of every great gravy."),
        new("Potato", "potato", "root", ProductUnit.Kg, 35, 0.25m, "Clean, starchy potatoes that roast golden and mash creamy. A kitchen essential."),
        new("Carrot", "carrot", "root", ProductUnit.Kg, 60, 0.25m, "Crunchy Ooty carrots, naturally sweet. Great for halwa, poriyal and fresh juice."),
        new("Beans", "beans", "green", ProductUnit.Kg, 50, 0.25m, "Tender French beans that snap when bent. Stir-fry, steam or add to pulao."),
        new("Cabbage", "cabbage", "leafy", ProductUnit.Piece, 25, 1, "Tight, crisp green cabbage heads (approx. 700–900 g each). Great for thoran and salads."),
        new("Brinjal", "brinjal", "seasonal", ProductUnit.Kg, 40, 0.25m, "Shiny purple brinjals with soft seeds — perfect for baingan bharta and gutti vankaya."),
        new("Spinach", "spinach", "leafy", ProductUnit.Bunch, 20, 1, "Fresh palak bunches, washed and trimmed. Rich in iron for dal palak and palak paneer."),
        new("Coriander", "coriander", "herbs", ProductUnit.Bunch, 15, 1, "Fragrant coriander bunches with roots on for longer freshness."),
        new("Cauliflower", "cauliflower", "seasonal", ProductUnit.Piece, 35, 1, "Snow-white, compact cauliflower heads (approx. 600–800 g). Perfect for gobi masala."),
        new("Cucumber", "cucumber", "green", ProductUnit.Kg, 40, 0.25m, "Cool, crisp cucumbers with thin skin. Ideal for raita, salads and sandwiches."),
        new("Capsicum", "capsicum", "green", ProductUnit.Kg, 70, 0.25m, "Thick-walled green capsicum with a fresh crunch. Great for stir-fries and stuffing."),
        new("Lady Finger", "okra", "green", ProductUnit.Kg, 50, 0.25m, "Tender bhindi, hand-picked young so it stays crisp and never stringy."),
        new("Beetroot", "beetroot", "root", ProductUnit.Kg, 45, 0.25m, "Earthy, ruby-red beetroot. Lovely in salads, juices and poriyal."),
        new("Bottle Gourd", "bottle-gourd", "green", ProductUnit.Piece, 30, 1, "Light green lauki (approx. 800 g – 1 kg each). Mild and cooling — great for kootu and halwa."),
        new("Pumpkin", "pumpkin", "seasonal", ProductUnit.Kg, 35, 0.5m, "Sweet orange pumpkin, cut fresh to order. Perfect for sambar and soups."),
        new("Garlic", "garlic", "herbs", ProductUnit.Kg, 180, 0.1m, "Plump, pungent garlic bulbs with tight cloves."),
        new("Ginger", "ginger", "herbs", ProductUnit.Kg, 120, 0.1m, "Juicy, aromatic ginger root — essential for chai, curries and chutneys."),
        new("Radish", "radish", "root", ProductUnit.Kg, 40, 0.25m, "Crisp white mooli with a gentle peppery kick. Great for parathas and sambar."),
        new("Broccoli", "broccoli", "green", ProductUnit.Piece, 60, 1, "Deep green broccoli heads (approx. 300–400 g) with tight florets."),
        new("Green Peas", "green-peas", "green", ProductUnit.Kg, 90, 0.25m, "Sweet, plump green peas in the pod. Shell fresh for pulao and matar paneer."),
        new("Mint", "mint", "herbs", ProductUnit.Bunch, 10, 1, "Cool, fragrant pudina bunches for chutneys, biryani and mojitos."),
    ];

    public static async Task SeedAsync(AppDbContext db, IPasswordHasher<AdminUser> hasher)
    {
        if (!await db.Categories.AnyAsync())
        {
            db.Categories.AddRange(
                new Category { Name = "Leafy Vegetables", Slug = "leafy", SortOrder = 1 },
                new Category { Name = "Green Vegetables", Slug = "green", SortOrder = 2 },
                new Category { Name = "Root Vegetables", Slug = "root", SortOrder = 3 },
                new Category { Name = "Seasonal Vegetables", Slug = "seasonal", SortOrder = 4 },
                new Category { Name = "Herbs & Aromatics", Slug = "herbs", SortOrder = 5 });
            await db.SaveChangesAsync();
        }

        if (!await db.AdminUsers.AnyAsync(a => a.Role == AdminRole.SuperAdmin))
        {
            var super = new AdminUser { Role = AdminRole.SuperAdmin, FullName = "Platform Admin", Username = "superadmin", Email = "platform@freshnhealthy.in", Phone = "9000000000" };
            super.PasswordHash = hasher.HashPassword(super, "Super@123");
            db.AdminUsers.Add(super);
            await db.SaveChangesAsync();
        }

        if (await db.Shops.AnyAsync()) return;

        var categories = await db.Categories.ToDictionaryAsync(c => c.Slug, c => c.Id);

        var greenBasket = await CreateShop(db, hasher, categories,
            new Shop
            {
                Name = "Green Basket Organics", Slug = "green-basket", OwnerName = "Ravi Kumar", Email = "ravi@greenbasket.in", Phone = "9848012345",
                LicenseNumber = "FSSAI-13623011000123", GstNumber = "36AABCG1234F1Z5", AddressLine = "Plot 42, Road No. 12, Banjara Hills", City = "Hyderabad", Pincode = "500034",
                Tagline = "Farm-fresh vegetables from Telangana growers",
                Settings = new ShopSettings { ContactPhone = "9848012345", AcceptsUpi = true, UpiId = "greenbasket@okaxis", UpiPayeeName = "Green Basket Organics", AcceptsCod = true, DeliveryFee = 25, FreeDeliveryAbove = 299, DeliveryEta = "30-45 min" },
            },
            "greenbasket", "Admin@123",
            new Dictionary<string, decimal>
            {
                ["Green Chilli"] = 10, ["Tomato"] = 40, ["Onion"] = 60, ["Potato"] = 80, ["Carrot"] = 25, ["Beans"] = 2, ["Cabbage"] = 0, ["Brinjal"] = 18,
                ["Spinach"] = 30, ["Coriander"] = 3, ["Cauliflower"] = 15, ["Cucumber"] = 20, ["Capsicum"] = 12, ["Lady Finger"] = 14, ["Beetroot"] = 16,
                ["Bottle Gourd"] = 10, ["Pumpkin"] = 1.5m, ["Garlic"] = 8, ["Ginger"] = 6, ["Radish"] = 12, ["Broccoli"] = 0, ["Green Peas"] = 9, ["Mint"] = 25,
            },
            priceFactor: 1.0m, featured: ["Tomato", "Green Chilli", "Carrot", "Spinach"]);

        await CreateShop(db, hasher, categories,
            new Shop
            {
                Name = "Farm Fresh Mandi", Slug = "farm-fresh-mandi", OwnerName = "Lakshmi Narayan", Email = "hello@farmfreshmandi.in", Phone = "9845098450",
                LicenseNumber = "FSSAI-11223344556677", AddressLine = "No. 18, 4th Cross, Jayanagar 4th Block", City = "Bengaluru", Pincode = "560011",
                Tagline = "Straight from Kolar farms to your kitchen",
                Settings = new ShopSettings { ContactPhone = "9845098450", AcceptsUpi = true, UpiId = "farmfreshmandi@ybl", UpiPayeeName = "Farm Fresh Mandi", AcceptsCod = false, DeliveryFee = 30, FreeDeliveryAbove = 399, DeliveryEta = "45-60 min" },
            },
            "farmfresh", "Admin@123",
            new Dictionary<string, decimal>
            {
                ["Tomato"] = 0, ["Onion"] = 45, ["Potato"] = 50, ["Carrot"] = 30, ["Beans"] = 20, ["Cabbage"] = 12, ["Capsicum"] = 2.5m, ["Cucumber"] = 18,
                ["Green Chilli"] = 6, ["Coriander"] = 40, ["Beetroot"] = 10, ["Radish"] = 8, ["Lady Finger"] = 15, ["Brinjal"] = 20, ["Ginger"] = 5, ["Garlic"] = 7,
            },
            priceFactor: 1.1m, featured: ["Carrot", "Beans", "Capsicum"]);

        await CreateShop(db, hasher, categories,
            new Shop
            {
                Name = "Daily Harvest Veggies", Slug = "daily-harvest", OwnerName = "Senthil Murugan", Email = "orders@dailyharvest.in", Phone = "9840098400",
                LicenseNumber = "TN-TL-2024-005521", AddressLine = "12, Usman Road, T. Nagar", City = "Chennai", Pincode = "600017",
                Tagline = "Picked at dawn, delivered by noon",
                Settings = new ShopSettings { ContactPhone = "9840098400", AcceptsUpi = false, AcceptsCod = true, DeliveryFee = 20, FreeDeliveryAbove = 249, DeliveryEta = "25-40 min" },
            },
            "dailyharvest", "Admin@123",
            new Dictionary<string, decimal>
            {
                ["Tomato"] = 35, ["Onion"] = 50, ["Potato"] = 40, ["Brinjal"] = 0, ["Lady Finger"] = 12, ["Bottle Gourd"] = 8, ["Pumpkin"] = 20, ["Drumstick"] = 0,
                ["Green Chilli"] = 5, ["Coriander"] = 30, ["Mint"] = 20, ["Spinach"] = 2, ["Carrot"] = 15, ["Beans"] = 10, ["Cauliflower"] = 6,
            },
            priceFactor: 0.95m, featured: ["Tomato", "Lady Finger", "Coriander"]);

        await SeedOrders(db, greenBasket);
    }

    private static async Task<Shop> CreateShop(AppDbContext db, IPasswordHasher<AdminUser> hasher, Dictionary<string, int> categories,
        Shop shop, string username, string password, Dictionary<string, decimal> stock, decimal priceFactor, string[] featured)
    {
        var admin = new AdminUser { Shop = shop, Role = AdminRole.ShopAdmin, FullName = shop.OwnerName, Username = username, Email = shop.Email, Phone = shop.Phone };
        admin.PasswordHash = hasher.HashPassword(admin, password);
        db.AdminUsers.Add(admin);

        var order = 0;
        foreach (var (name, qty) in stock)
        {
            var item = Catalog.FirstOrDefault(c => c.Name == name);
            if (item is null) continue;
            var price = Math.Round(item.Price * priceFactor / 5m, 0) * 5m;
            shop.Products.Add(new Product
            {
                Name = item.Name,
                LocalName = TeluguNames.ByImageKey.GetValueOrDefault(item.Image),
                Description = item.Description,
                CategoryId = categories[item.Category],
                ImageUrl = $"/images/catalog/{item.Image}.jpg",
                Unit = item.Unit,
                Price = price < 5 ? 5 : price,
                StockQuantity = qty,
                MinOrderQuantity = item.Step,
                StepQuantity = item.Step,
                LowStockThreshold = item.Unit == ProductUnit.Kg ? 3 : 5,
                IsFeatured = featured.Contains(item.Name),
                SortOrder = ++order,
            });
        }
        await db.SaveChangesAsync();

        db.StockMovements.AddRange(shop.Products.Where(p => p.StockQuantity > 0).Select(p => new StockMovement
        {
            ProductId = p.Id, Change = p.StockQuantity, BalanceAfter = p.StockQuantity, Reason = StockMovementReason.Initial, CreatedBy = shop.OwnerName, Note = "Opening stock",
        }));
        await db.SaveChangesAsync();
        return shop;
    }

    private static async Task SeedOrders(AppDbContext db, Shop shop)
    {
        var customers = new[]
        {
            new Customer { Phone = "9876543210", Name = "Priya Sharma", AddressLine = "Flat 302, Lake View Apartments, Road No. 3", Landmark = "Near KBR Park", City = "Hyderabad", Pincode = "500034" },
            new Customer { Phone = "9123456780", Name = "Rahul Verma", AddressLine = "H.No 8-2-293, Jubilee Hills", City = "Hyderabad", Pincode = "500033" },
            new Customer { Phone = "9988776655", Name = "Anita Reddy", AddressLine = "21, Srinagar Colony", City = "Hyderabad", Pincode = "500073" },
            new Customer { Phone = "9012345678", Name = "Mohammed Irfan", AddressLine = "6-3-1090, Somajiguda", City = "Hyderabad", Pincode = "500082" },
        };
        db.Customers.AddRange(customers);
        await db.SaveChangesAsync();

        var products = shop.Products.ToList();
        var rng = new Random(42);
        var statuses = new[] { OrderStatus.Completed, OrderStatus.Completed, OrderStatus.Completed, OrderStatus.Completed, OrderStatus.Processing, OrderStatus.Confirmed, OrderStatus.Pending, OrderStatus.Cancelled };

        for (var i = 0; i < 26; i++)
        {
            var customer = customers[rng.Next(customers.Length)];
            var daysAgo = i < 3 ? 0 : rng.Next(0, 14);
            var created = DateTime.UtcNow.AddDays(-daysAgo).AddMinutes(-rng.Next(30, 600));
            var status = daysAgo > 2 ? (rng.Next(10) == 0 ? OrderStatus.Cancelled : OrderStatus.Completed) : statuses[rng.Next(statuses.Length)];

            var items = products.OrderBy(_ => rng.Next()).Take(rng.Next(2, 6)).Select(p =>
            {
                var qty = p.Unit == ProductUnit.Kg ? p.StepQuantity * rng.Next(2, 9) : rng.Next(1, 4);
                qty = Math.Round(qty, 3);
                return new OrderItem { ProductId = p.Id, ProductName = p.Name, ImageUrl = p.ImageUrl, Unit = p.Unit, UnitPrice = p.Price, Quantity = qty, LineTotal = OrderService.LineTotal(p.Price, qty) };
            }).ToList();

            var subtotal = items.Sum(x => x.LineTotal);
            var fee = subtotal >= (shop.Settings.FreeDeliveryAbove ?? decimal.MaxValue) ? 0 : shop.Settings.DeliveryFee;
            var method = rng.Next(2) == 0 ? PaymentMethod.Upi : PaymentMethod.Cod;
            var order = new Order
            {
                OrderNumber = $"FH{created:yyMMdd}-{(char)('A' + i % 26)}{rng.Next(1000, 9999)}",
                ShopId = shop.Id, CustomerId = customer.Id, Status = status, PaymentMethod = method,
                PaymentStatus = status == OrderStatus.Completed ? PaymentStatus.Paid : PaymentStatus.Pending,
                Fulfillment = FulfillmentType.Delivery, Subtotal = subtotal, DeliveryFee = fee, Total = subtotal + fee,
                CustomerName = customer.Name, CustomerPhone = customer.Phone,
                DeliveryAddress = $"{customer.AddressLine}, {customer.City}, {customer.Pincode}",
                IdempotencyKey = Guid.NewGuid().ToString("N"), CreatedAt = created, UpdatedAt = created,
                CancelReason = status == OrderStatus.Cancelled ? "Customer changed plans" : null,
                Items = items,
            };
            order.History.Add(new OrderStatusHistory { Status = OrderStatus.Pending, Note = "Order placed", ChangedBy = customer.Name, ChangedAt = created });
            if (status != OrderStatus.Pending)
                order.History.Add(new OrderStatusHistory { Status = status, ChangedBy = shop.OwnerName, ChangedAt = created.AddMinutes(20) });
            db.Orders.Add(order);
        }
        await db.SaveChangesAsync();
    }
}
