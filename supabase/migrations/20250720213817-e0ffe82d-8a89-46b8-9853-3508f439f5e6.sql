-- Update user metadata to include organization_id
UPDATE auth.users 
SET user_metadata = user_metadata || jsonb_build_object('organization_id', '847cc145-5b8d-4f7b-9ab6-966b9b07abfe')
WHERE id = '3fa781a0-9ec2-48bb-bfc7-3ff790b4bb4b';