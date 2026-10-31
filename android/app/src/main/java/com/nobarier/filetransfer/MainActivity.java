package com.nobarier.filetransfer;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Log;
import android.webkit.JavascriptInterface;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import org.json.JSONObject;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "NoBarierMain";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Request storage and camera permissions
        requestDevicePermissions();

        // Register AndroidGallery bridge to WebView
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().addJavascriptInterface(new AndroidGalleryBridge(this), "AndroidGallery");
            Log.i(TAG, "AndroidGallery bridge registered successfully");
        }
    }

    private void requestDevicePermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            String[] permissions = new String[]{
                Manifest.permission.READ_MEDIA_IMAGES,
                Manifest.permission.READ_MEDIA_VIDEO,
                Manifest.permission.READ_MEDIA_AUDIO,
                Manifest.permission.CAMERA
            };
            ActivityCompat.requestPermissions(this, permissions, 101);
        } else {
            String[] permissions = new String[]{
                Manifest.permission.READ_EXTERNAL_STORAGE,
                Manifest.permission.WRITE_EXTERNAL_STORAGE,
                Manifest.permission.CAMERA
            };
            ActivityCompat.requestPermissions(this, permissions, 101);
        }
    }

    public static class AndroidGalleryBridge {
        private static final String BRIDGE_TAG = "NoBarierGallery";
        private final Context context;
        private final Map<String, FileOutputStream> activeStreams = new ConcurrentHashMap<>();
        private final Map<String, File> tempFiles = new ConcurrentHashMap<>();
        private final Map<String, String> mimeTypes = new ConcurrentHashMap<>();
        private final Map<String, String> originalNames = new ConcurrentHashMap<>();

        public AndroidGalleryBridge(Context context) {
            this.context = context;
        }

        @JavascriptInterface
        public String isAvailable() {
            return "true";
        }

        @JavascriptInterface
        public String startFile(String transferId, String fileName, String mimeType) {
            try {
                File cacheDir = new File(context.getCacheDir(), "incoming_transfers");
                if (!cacheDir.exists()) {
                    cacheDir.mkdirs();
                }

                File tempFile = new File(cacheDir, transferId + "_" + fileName);
                if (tempFile.exists()) {
                    tempFile.delete();
                }

                FileOutputStream fos = new FileOutputStream(tempFile);
                activeStreams.put(transferId, fos);
                tempFiles.put(transferId, tempFile);
                mimeTypes.put(transferId, mimeType != null ? mimeType : "");
                originalNames.put(transferId, fileName != null ? fileName : "file");

                JSONObject res = new JSONObject();
                res.put("success", true);
                return res.toString();
            } catch (Exception e) {
                Log.e(BRIDGE_TAG, "startFile error: " + e.getMessage(), e);
                return errorJson(e.getMessage());
            }
        }

        @JavascriptInterface
        public String appendChunk(String transferId, String base64Chunk) {
            try {
                FileOutputStream fos = activeStreams.get(transferId);
                if (fos == null) {
                    return errorJson("Stream not found for transferId: " + transferId);
                }

                byte[] data = Base64.decode(base64Chunk, Base64.NO_WRAP);
                fos.write(data);

                JSONObject res = new JSONObject();
                res.put("success", true);
                return res.toString();
            } catch (Exception e) {
                Log.e(BRIDGE_TAG, "appendChunk error: " + e.getMessage(), e);
                return errorJson(e.getMessage());
            }
        }

        @JavascriptInterface
        public String finishFile(String transferId) {
            FileOutputStream fos = activeStreams.remove(transferId);
            File tempFile = tempFiles.remove(transferId);
            String mime = mimeTypes.remove(transferId);
            String fileName = originalNames.remove(transferId);

            if (tempFile == null || !tempFile.exists()) {
                return errorJson("Temp file missing");
            }

            try {
                if (fos != null) {
                    fos.flush();
                    fos.close();
                }

                Uri savedUri = null;
                String savedPath = null;
                ContentResolver resolver = context.getContentResolver();
                ContentValues values = new ContentValues();
                values.put(MediaStore.MediaColumns.DISPLAY_NAME, fileName);
                if (mime != null && !mime.isEmpty()) {
                    values.put(MediaStore.MediaColumns.MIME_TYPE, mime);
                }

                boolean isImage = (mime != null && mime.startsWith("image/")) || hasExtension(fileName, "jpg", "jpeg", "png", "webp", "gif", "heic");
                boolean isVideo = (mime != null && mime.startsWith("video/")) || hasExtension(fileName, "mp4", "mkv", "mov", "webm", "3gp", "avi");
                boolean isAudio = (mime != null && mime.startsWith("audio/")) || hasExtension(fileName, "mp3", "m4a", "wav", "aac", "ogg", "flac");

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    values.put(MediaStore.MediaColumns.IS_PENDING, 1);
                    Uri collection;
                    if (isVideo) {
                        values.put(MediaStore.Video.Media.RELATIVE_PATH, Environment.DIRECTORY_MOVIES + "/NoBarier");
                        collection = MediaStore.Video.Media.EXTERNAL_CONTENT_URI;
                    } else if (isImage) {
                        values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/NoBarier");
                        collection = MediaStore.Images.Media.EXTERNAL_CONTENT_URI;
                    } else if (isAudio) {
                        values.put(MediaStore.Audio.Media.RELATIVE_PATH, Environment.DIRECTORY_MUSIC + "/NoBarier");
                        collection = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI;
                    } else {
                        values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/NoBarier");
                        collection = MediaStore.Downloads.EXTERNAL_CONTENT_URI;
                    }

                    savedUri = resolver.insert(collection, values);
                    if (savedUri != null) {
                        try (OutputStream out = resolver.openOutputStream(savedUri);
                             InputStream in = new FileInputStream(tempFile)) {
                            byte[] buffer = new byte[65536];
                            int bytesRead;
                            while ((bytesRead = in.read(buffer)) != -1) {
                                out.write(buffer, 0, bytesRead);
                            }
                            out.flush();
                        }
                        values.clear();
                        values.put(MediaStore.MediaColumns.IS_PENDING, 0);
                        resolver.update(savedUri, values, null, null);
                    }
                } else {
                    // Legacy Android (< Q)
                    File targetDir;
                    if (isVideo) {
                        targetDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_MOVIES);
                    } else if (isImage) {
                        targetDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES);
                    } else if (isAudio) {
                        targetDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_MUSIC);
                    } else {
                        targetDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                    }
                    File noBarierDir = new File(targetDir, "NoBarier");
                    if (!noBarierDir.exists()) {
                        noBarierDir.mkdirs();
                    }
                    File targetFile = new File(noBarierDir, fileName);

                    try (OutputStream out = new FileOutputStream(targetFile);
                         InputStream in = new FileInputStream(tempFile)) {
                        byte[] buffer = new byte[65536];
                        int bytesRead;
                        while ((bytesRead = in.read(buffer)) != -1) {
                            out.write(buffer, 0, bytesRead);
                        }
                        out.flush();
                    }
                    savedPath = targetFile.getAbsolutePath();
                    savedUri = Uri.fromFile(targetFile);
                }

                // Delete temporary incoming cache file
                tempFile.delete();

                // Trigger MediaScanner so Google Photos and Gallery apps index it immediately
                final String finalUriStr = savedUri != null ? savedUri.toString() : "";
                final String finalPath = savedPath;
                if (savedPath != null) {
                    MediaScannerConnection.scanFile(context, new String[]{savedPath}, new String[]{mime}, null);
                } else if (savedUri != null) {
                    context.sendBroadcast(new Intent(Intent.ACTION_MEDIA_SCANNER_SCAN_FILE, savedUri));
                }

                JSONObject res = new JSONObject();
                res.put("success", true);
                res.put("uri", finalUriStr);
                res.put("path", finalPath != null ? finalPath : "");
                return res.toString();
            } catch (Exception e) {
                Log.e(BRIDGE_TAG, "finishFile error: " + e.getMessage(), e);
                return errorJson(e.getMessage());
            }
        }

        @JavascriptInterface
        public String deleteMedia(String uriOrPath, String fileName) {
            try {
                boolean deleted = false;
                ContentResolver resolver = context.getContentResolver();

                if (uriOrPath != null && uriOrPath.startsWith("content://")) {
                    try {
                        int count = resolver.delete(Uri.parse(uriOrPath), null, null);
                        if (count > 0) deleted = true;
                    } catch (Exception ex) {
                        Log.w(BRIDGE_TAG, "ContentResolver delete failed: " + ex.getMessage());
                    }
                }

                // Search MediaStore by DISPLAY_NAME if not yet deleted
                if (!deleted && fileName != null && !fileName.isEmpty()) {
                    Uri[] collections = new Uri[]{
                        MediaStore.Video.Media.EXTERNAL_CONTENT_URI,
                        MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                        MediaStore.Audio.Media.EXTERNAL_CONTENT_URI,
                        Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q ? MediaStore.Downloads.EXTERNAL_CONTENT_URI : null
                    };
                    for (Uri collection : collections) {
                        if (collection == null) continue;
                        try {
                            int count = resolver.delete(collection, MediaStore.MediaColumns.DISPLAY_NAME + "=?", new String[]{fileName});
                            if (count > 0) {
                                deleted = true;
                                break;
                            }
                        } catch (Exception ignored) {}
                    }
                }

                // Also check direct filesystem path
                if (uriOrPath != null && uriOrPath.startsWith("/")) {
                    File f = new File(uriOrPath);
                    if (f.exists() && f.delete()) {
                        deleted = true;
                        MediaScannerConnection.scanFile(context, new String[]{f.getAbsolutePath()}, null, null);
                    }
                }

                JSONObject res = new JSONObject();
                res.put("success", deleted);
                return res.toString();
            } catch (Exception e) {
                Log.e(BRIDGE_TAG, "deleteMedia error: " + e.getMessage(), e);
                return errorJson(e.getMessage());
            }
        }

        private boolean hasExtension(String name, String... exts) {
            if (name == null) return false;
            String lower = name.toLowerCase();
            for (String ext : exts) {
                if (lower.endsWith("." + ext)) return true;
            }
            return false;
        }

        private String errorJson(String msg) {
            try {
                JSONObject res = new JSONObject();
                res.put("success", false);
                res.put("error", msg != null ? msg : "Unknown error");
                return res.toString();
            } catch (Exception e) {
                return "{\"success\":false,\"error\":\"error\"}";
            }
        }
    }
}
