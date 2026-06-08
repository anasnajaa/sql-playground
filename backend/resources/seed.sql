-- ============================================================
-- SQL Playground seed script — reset to this baseline at any time
-- ============================================================

-- Drop in FK-safe reverse order
IF OBJECT_ID('dbo.Shippings', 'U') IS NOT NULL DROP TABLE dbo.Shippings;
IF OBJECT_ID('dbo.Orders',    'U') IS NOT NULL DROP TABLE dbo.Orders;
IF OBJECT_ID('dbo.Customers', 'U') IS NOT NULL DROP TABLE dbo.Customers;

-- 1. Customers
CREATE TABLE Customers (
    customer_id INT PRIMARY KEY,
    first_name  VARCHAR(50),
    last_name   VARCHAR(50),
    age         INT,
    country     VARCHAR(50)
);

-- 2. Orders
CREATE TABLE Orders (
    order_id    INT PRIMARY KEY,
    item        VARCHAR(50),
    amount      DECIMAL(10, 2),
    customer_id INT,
    FOREIGN KEY (customer_id) REFERENCES Customers(customer_id)
);

-- 3. Shippings
CREATE TABLE Shippings (
    shipping_id INT PRIMARY KEY,
    status      VARCHAR(50),
    customer    INT,
    FOREIGN KEY (customer) REFERENCES Customers(customer_id)
);

-- 4. Seed Customers
INSERT INTO Customers (customer_id, first_name, last_name, age, country) VALUES
(1, 'John',   'Doe',       31, 'USA'),
(2, 'Robert', 'Luna',      22, 'USA'),
(3, 'David',  'Robinson',  22, 'UK'),
(4, 'John',   'Reinhardt', 25, 'UK'),
(5, 'Betty',  'Doe',       28, 'UAE');

-- 5. Seed Orders
INSERT INTO Orders (order_id, item, amount, customer_id) VALUES
(1, 'Keyboard', 400.00,   4),
(2, 'Mouse',    300.00,   4),
(3, 'Monitor',  12000.00, 3),
(4, 'Keyboard', 400.00,   1),
(5, 'Mousepad', 250.00,   2);

-- 6. Seed Shippings
INSERT INTO Shippings (shipping_id, status, customer) VALUES
(1, 'Pending',   2),
(2, 'Pending',   4),
(3, 'Delivered', 3),
(4, 'Pending',   5),
(5, 'Delivered', 1);
