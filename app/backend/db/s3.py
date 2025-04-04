import boto3
import hashlib

from datetime import datetime
from typing import List, Optional
from botocore.exceptions import ClientError


def upload_texts_to_s3(
    texts: List[str],
    bucket_name: str,
) -> List[Optional[str]]:
    """
    Uploads a list of strings to an S3-compatible service under a YYYY/MM/DD structure.

    Uses the BLAKE2b 128 bits hash of the file as the filename.

    Args:
        texts: A list of strings to save to files.
        bucket_name: The name of the bucket to upload to.

    Returns:
        A list of S3 object URLs corresponding to the texts.
        If an upload fails or an error occurs for a specific text, its
        corresponding entry in the list will be None.

    TO-DO: 
        - Make returned data consistent after potential endpoint changes.
        - Support different media types.
        - Avoid duplicates across the whole bucket.
    """

    uploaded_urls: List[Optional[str]] = []
    s3_client = None

    # S3 Client Initialization
    try:
        s3_client = boto3.client(
            's3',
            endpoint_url=S3_ENDPOINT_URL,
            aws_access_key_id=S3_ACCESS_KEY,
            aws_secret_access_key=S3_SECRET_KEY,
        )
        # Verify bucket exists and is accessible
        s3_client.head_bucket(Bucket=bucket_name)
        print(f"Successfully connected to S3 bucket '{bucket_name}'.")

    except ClientError as e:
        error_code = e.response.get('Error', {}).get('Code')
        if error_code == 'NoSuchBucket':
            print(f"Error: Bucket '{bucket_name}' does not exist.")
        elif error_code == '403':
             print(f"Error: Access denied to bucket '{bucket_name}'. Check credentials/permissions.")
        else:
            print(f"Error connecting to S3 or accessing bucket '{bucket_name}': {e}")
        raise
    except Exception as e:
        print(f"An unexpected error occurred creating the S3 client or accessing the bucket: {e}")
        raise

    endpoint_url = s3_client.meta.endpoint_url
    base_url_prefix = f"{endpoint_url.rstrip('/')}/{bucket_name}"

    date_prefix = datetime.now().strftime("%Y/%m/%d") # Structure: YYYY/MM/DD

    # --- Process Each Text ---
    for index, text_content in enumerate(texts):
        object_url = None  # Default to None
        object_key = None

        if not isinstance(text_content, str):
             print(f"Skipping item {index+1}/{len(texts)}: Input is not a string ({type(text_content)}).")
             uploaded_urls.append(None)
             continue
        if not text_content:
             print(f"Skipping item {index+1}/{len(texts)}: Input string is empty.")
             uploaded_urls.append(None)
             continue

        try:
            text_bytes = text_content.encode('utf-8')
            # Use BLAKE2b for 128 bits (16 bytes)
            file_hash = hashlib.blake2b(text_bytes, digest_size=16).hexdigest()
            object_key = f"{date_prefix}/{file_hash}.txt"
            potential_url = f"{base_url_prefix}/{object_key}"

            print(f"Uploading text {index+1}/{len(texts)} to s3://{bucket_name}/{object_key}...")

            put_object_args = {
                'Bucket': bucket_name,
                'Key': object_key,
                'Body': text_bytes,
                'ContentType': 'text/plain; charset=utf-8' # Be explicit about encoding
            }

            s3_client.put_object(**put_object_args)
            object_url = potential_url
            print(f"Successfully uploaded. URL: {object_url}")

        except Exception as e:
            key_info = f"s3://{bucket_name}/{object_key}" if object_key else "unknown key"
            print(f"Error processing text {index+1}/{len(texts)} for {key_info}: {e}")

        uploaded_urls.append(object_url) # Append URL or None

    return uploaded_urls
