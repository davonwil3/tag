-- Enable Row Level Security
ALTER TABLE "Rule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;

-- Create policies for Rule table
CREATE POLICY "Enable read access for authenticated users" ON "Rule"
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Enable insert for authenticated users" ON "Rule"
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON "Rule"
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Enable delete for authenticated users" ON "Rule"
    FOR DELETE
    TO authenticated
    USING (true);

-- Create policies for Session table
CREATE POLICY "Enable read access for authenticated users" ON "Session"
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Enable insert for authenticated users" ON "Session"
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON "Session"
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Enable delete for authenticated users" ON "Session"
    FOR DELETE
    TO authenticated
    USING (true);

-- Create a function to check if the user has access to the shop
CREATE OR REPLACE FUNCTION check_shop_access(shop_domain TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    -- Check if the user's session matches the shop domain
    RETURN EXISTS (
        SELECT 1 FROM "Session"
        WHERE "Session".shop = shop_domain
        AND "Session".expires > NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add shop-specific policies for Rule table
CREATE POLICY "Users can only access their own shop's rules" ON "Rule"
    FOR ALL
    TO authenticated
    USING (check_shop_access(shop))
    WITH CHECK (check_shop_access(shop)); 