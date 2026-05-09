import React, { useEffect, useState } from "react";
import { View, Linking, Pressable, ActivityIndicator, Platform as RNPlatform } from "react-native";
import { WebView } from "react-native-webview";
import { Image } from "expo-image";
import { 
  Youtube, 
  Twitter, 
  Instagram, 
  Linkedin, 
  Facebook, 
  Github, 
  MessageSquare, 
  MessageCircle, 
  Music, 
  Video, 
  Cloud, 
  AtSign, 
  HelpCircle,
  ExternalLink,
  Globe
} from "lucide-react-native";
import { Text } from "./ui/text";
import { useThemeColors } from "@/lib/use-theme-colors";
import { fetchSocialMetadata, type SocialMetadata } from "@/lib/social-metadata";
import { cn } from "@/lib/utils";

interface SocialEmbedProps {
  url: string;
  className?: string;
}

const getPlatformIcon = (platform: string, size: number, color: string) => {
  switch (platform) {
    case "youtube": return <Youtube size={size} color={color} />;
    case "twitter": return <Twitter size={size} color={color} />;
    case "instagram": return <Instagram size={size} color={color} />;
    case "linkedin": return <Linkedin size={size} color={color} />;
    case "facebook": return <Facebook size={size} color={color} />;
    case "github": return <Github size={size} color={color} />;
    case "reddit": return <MessageSquare size={size} color={color} />;
    case "discord": return <MessageCircle size={size} color={color} />;
    case "spotify": return <Music size={size} color={color} />;
    case "tiktok": return <Video size={size} color={color} />;
    case "bluesky": return <Cloud size={size} color={color} />;
    case "threads": return <AtSign size={size} color={color} />;
    case "quora": return <HelpCircle size={size} color={color} />;
    default: return <Globe size={size} color={color} />;
  }
};

const getPlatformName = (platform: string) => {
  switch (platform) {
    case "youtube": return "YouTube";
    case "twitter": return "Twitter / X";
    case "instagram": return "Instagram";
    case "linkedin": return "LinkedIn";
    case "facebook": return "Facebook";
    case "github": return "GitHub";
    case "reddit": return "Reddit";
    case "discord": return "Discord";
    case "spotify": return "Spotify";
    case "tiktok": return "TikTok";
    case "bluesky": return "BlueSky";
    case "threads": return "Threads";
    case "quora": return "Quora";
    default: return "Web";
  }
};

export const SocialEmbed: React.FC<SocialEmbedProps> = ({ url, className }) => {
  const { colors, isDark } = useThemeColors();
  const [metadata, setMetadata] = useState<SocialMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const loadMetadata = async () => {
      try {
        setLoading(true);
        const data = await fetchSocialMetadata(url);
        if (isMounted) {
          setMetadata(data);
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to fetch social metadata:", err);
        if (isMounted) {
          setError(true);
          setLoading(false);
        }
      }
    };

    loadMetadata();
    return () => { isMounted = false; };
  }, [url]);

  const handlePress = () => {
    Linking.openURL(url).catch((err) => console.error("Couldn't load page", err));
  };

  if (loading) {
    return (
      <View className={cn("my-4 p-4 rounded-2xl border border-border/50 bg-muted/30 items-center justify-center h-32", className)}>
        <ActivityIndicator color={colors.primary} />
        <Text className="text-muted-foreground text-xs mt-2">Fetching metadata...</Text>
      </View>
    );
  }

  if (error || !metadata) {
    return (
      <Pressable 
        onPress={handlePress}
        className={cn("my-4 p-4 rounded-2xl border border-border/50 bg-muted/30 flex-row items-center", className)}
      >
        <ExternalLink size={20} color={colors.mutedForeground} />
        <Text className="text-muted-foreground text-sm ml-2 flex-1" numberOfLines={1}>{url}</Text>
      </Pressable>
    );
  }

  // YouTube specialized player
  if (metadata.platform === "youtube" && metadata.videoId) {
    return (
      <View className={cn("my-4 overflow-hidden rounded-2xl border border-border bg-black", className)}>
        <View style={{ aspectRatio: 16 / 9, width: "100%" }}>
          <WebView
            allowsFullscreenVideo
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            originWhitelist={["*"]}
            source={{
              html: `
                <!DOCTYPE html>
                <html>
                  <head>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
                    <style>
                      body { margin: 0; padding: 0; background-color: black; overflow: hidden; }
                      .video-container { position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; }
                      .video-container iframe { position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0; }
                    </style>
                  </head>
                  <body>
                    <div class="video-container">
                      <iframe 
                        src="https://www.youtube.com/embed/${metadata.videoId}?rel=0&modestbranding=1" 
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                        allowfullscreen>
                      </iframe>
                    </div>
                  </body>
                </html>
              `
            }}
            style={{ backgroundColor: "transparent" }}
          />
        </View>
        <Pressable onPress={handlePress} className="p-3 bg-muted/50 flex-row items-center justify-between border-t border-border/30">
          <View className="flex-row items-center flex-1">
            <Youtube size={16} color="#FF0000" />
            <Text className="text-foreground text-xs font-semibold ml-2 flex-1" numberOfLines={1}>
              {metadata.title || "YouTube Video"}
            </Text>
          </View>
          <ExternalLink size={14} color={colors.mutedForeground} />
        </Pressable>
      </View>
    );
  }

  // Generic metadata card
  return (
    <Pressable 
      onPress={handlePress}
      className={cn(
        "my-4 overflow-hidden rounded-2xl border border-border bg-card shadow-sm",
        className
      )}
    >
      {metadata.image && (
        <Image 
          source={{ uri: metadata.image }} 
          contentFit="cover"
          style={{ width: "100%", aspectRatio: 1.91 }} // OG standard aspect ratio
        />
      )}
      <View className="p-4">
        <View className="flex-row items-center mb-2">
          <View className="p-1.5 rounded-lg bg-primary/10 mr-2">
            {getPlatformIcon(metadata.platform, 16, colors.primary)}
          </View>
          <Text className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider">
            {getPlatformName(metadata.platform)}
          </Text>
        </View>
        
        <Text className="text-foreground font-bold text-base leading-tight mb-1" numberOfLines={2}>
          {metadata.title || "Social Post"}
        </Text>
        
        {metadata.description ? (
          <Text className="text-muted-foreground text-sm leading-snug mb-2" numberOfLines={3}>
            {metadata.description}
          </Text>
        ) : null}
        
        <View className="flex-row items-center justify-between mt-1">
          {metadata.authorName ? (
            <Text className="text-muted-foreground text-xs font-medium">
              by {metadata.authorName}
            </Text>
          ) : (
            <Text className="text-muted-foreground text-xs font-medium" numberOfLines={1}>
              {url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]}
            </Text>
          )}
          <ExternalLink size={14} color={colors.mutedForeground} />
        </View>
      </View>
    </Pressable>
  );
};
