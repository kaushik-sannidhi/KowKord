"use client";

import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Hash, Volume2, VolumeX, Settings, LogOut, Send, AtSign, Reply, ExternalLink, Users, FolderOpen, Folder } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';

const KowKord = () => {
    const [token, setToken] = useState('');
    const [user, setUser] = useState(null);
    const [guilds, setGuilds] = useState([]);
    const [channels, setChannels] = useState([]);
    const [messages, setMessages] = useState([]);
    const [selectedChannel, setSelectedChannel] = useState(null);
    const [selectedGuild, setSelectedGuild] = useState(null);
    const [messageInput, setMessageInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [dmChannels, setDmChannels] = useState([]);
    const [replyingTo, setReplyingTo] = useState(null);
    const [guildMembers, setGuildMembers] = useState({});
    const [error, setError] = useState('');
    const [hasMoreMessages, setHasMoreMessages] = useState(true);
    const messagesEndRef = useRef(null);
    const messagesContainerRef = useRef(null);

    const API_BASE = 'https://discord.com/api/v9';

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const apiRequest = async (endpoint, options = {}) => {
        try {
            const response = await fetch(`${API_BASE}${endpoint}`, {
                headers: {
                    'Authorization': token,
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    ...options.headers,
                },
                ...options,
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.status} ${response.statusText}`);
            }

            return response.json();
        } catch (err) {
            console.error('API Request failed:', err);
            throw err;
        }
    };

    const login = async () => {
        if (!token) return;

        setIsLoading(true);
        setError('');
        try {
            // Get current user info
            const userData = await apiRequest('/users/@me');
            setUser(userData);

            // Get user's guilds
            const guildsData = await apiRequest('/users/@me/guilds');
            setGuilds(guildsData);

            // Get user's DM channels
            const dmData = await apiRequest('/users/@me/channels');
            const sortedDMs = dmData
                .filter(ch => ch.type === 1 || ch.type === 3)
                .sort((a, b) => {
                    const aTime = a.last_message_id ? parseInt(a.last_message_id) / 4194304 + 1420070400000 : 0;
                    const bTime = b.last_message_id ? parseInt(b.last_message_id) / 4194304 + 1420070400000 : 0;
                    return bTime - aTime;
                });
            setDmChannels(sortedDMs);

        } catch (error) {
            console.error('Login failed:', error);
            setError('Login failed. Please check your token and try again.');
        }
        setIsLoading(false);
    };

    const logout = () => {
        setToken('');
        setUser(null);
        setGuilds([]);
        setChannels([]);
        setMessages([]);
        setSelectedChannel(null);
        setSelectedGuild(null);
        setDmChannels([]);
        setNotifications([]);
        setError('');
        setHasMoreMessages(true);
    };

    const selectGuild = async (guildId) => {
        if (guildId === 'dm') {
            setSelectedGuild('dm');
            setChannels([]);
            setSelectedChannel(null);
            return;
        }

        setSelectedGuild(guildId);
        setSelectedChannel(null);
        try {
            const channelsData = await apiRequest(`/guilds/${guildId}/channels`);
            const textChannels = channelsData
                .filter(ch => ch.type === 0 || ch.type === 2)
                .sort((a, b) => a.position - b.position);
            setChannels(textChannels);
        } catch (error) {
            console.error('Failed to fetch channels:', error);
            setError('Failed to load channels for this server.');
        }
    };

    const selectChannel = async (channelId) => {
        setSelectedChannel(channelId);
        setMessages([]);
        setHasMoreMessages(true);

        try {
            const messagesData = await apiRequest(`/channels/${channelId}/messages?limit=50`);
            setMessages(messagesData.reverse());
            setHasMoreMessages(messagesData.length === 50);
        } catch (error) {
            console.error('Failed to fetch messages:', error);
            setError('Failed to load messages for this channel.');
        }
    };

    const loadMoreMessages = async () => {
        if (!selectedChannel || isLoadingMessages || !hasMoreMessages || messages.length === 0) return;

        setIsLoadingMessages(true);
        try {
            const oldestMessageId = messages[0].id;
            const messagesData = await apiRequest(`/channels/${selectedChannel}/messages?before=${oldestMessageId}&limit=50`);

            if (messagesData.length === 0) {
                setHasMoreMessages(false);
            } else {
                setMessages(prev => [...messagesData.reverse(), ...prev]);
                setHasMoreMessages(messagesData.length === 50);
            }
        } catch (error) {
            console.error('Failed to load more messages:', error);
        }
        setIsLoadingMessages(false);
    };

    const handleScroll = (e) => {
        const { scrollTop } = e.target;
        if (scrollTop === 0 && hasMoreMessages && !isLoadingMessages) {
            loadMoreMessages();
        }
    };

    const sendMessage = async () => {
        if (!messageInput.trim() || !selectedChannel) return;

        try {
            const payload = {
                content: messageInput,
                ...(replyingTo && {
                    message_reference: {
                        message_id: replyingTo.id
                    }
                })
            };

            const newMessage = await apiRequest(`/channels/${selectedChannel}/messages`, {
                method: 'POST',
                body: JSON.stringify(payload),
            });

            setMessages(prev => [...prev, newMessage]);
            setMessageInput('');
            setReplyingTo(null);
        } catch (error) {
            console.error('Failed to send message:', error);
            setError('Failed to send message. Please try again.');
        }
    };

    const formatMessage = (content) => {
        // Handle mentions
        const mentionRegex = /<@!?(\d+)>/g;
        content = content.replace(mentionRegex, '<span class="bg-blue-500/20 text-blue-400 px-1 py-0.5 rounded font-medium">@user</span>');

        // Handle channel mentions
        const channelRegex = /<#(\d+)>/g;
        content = content.replace(channelRegex, '<span class="bg-blue-500/20 text-blue-400 px-1 py-0.5 rounded font-medium">#channel</span>');

        // Handle role mentions
        const roleRegex = /<@&(\d+)>/g;
        content = content.replace(roleRegex, '<span class="bg-purple-500/20 text-purple-400 px-1 py-0.5 rounded font-medium">@role</span>');

        return content;
    };

    const getChannelDisplayInfo = (channel) => {
        if (channel.type === 1) {
            // DM channel
            const recipient = channel.recipients?.[0];
            return {
                name: recipient?.username || 'User',
                avatar: recipient?.avatar ?
                    `https://cdn.discordapp.com/avatars/${recipient.id}/${recipient.avatar}.png` :
                    null,
                fallback: recipient?.username?.charAt(0)?.toUpperCase() || 'U'
            };
        } else if (channel.type === 3) {
            // Group DM channel
            return {
                name: channel.name || channel.recipients?.map(r => r.username).join(', ') || 'Group Chat',
                avatar: channel.icon ?
                    `https://cdn.discordapp.com/channel-icons/${channel.id}/${channel.icon}.png` :
                    null,
                fallback: channel.name?.charAt(0)?.toUpperCase() || 'G'
            };
        }
        return { name: 'Unknown', avatar: null, fallback: 'U' };
    };

    const MessageComponent = ({ message }) => {
        const isReply = message.message_reference;
        const referencedMessage = isReply ? messages.find(m => m.id === message.message_reference.message_id) : null;
        const isPing = message.mentions?.some(mention => mention.id === user?.id);

        return (
            <div className={`group hover:bg-gray-800/50 px-4 py-2 ${isPing ? 'bg-yellow-500/10 border-l-2 border-yellow-500' : ''}`}>
                {isReply && referencedMessage && (
                    <div className="flex items-center text-xs text-gray-400 mb-1 ml-14">
                        <Reply className="w-3 h-3 mr-1" />
                        <span className="font-medium text-gray-300">{referencedMessage.author.username}</span>
                        <span className="ml-2 truncate max-w-xs">{referencedMessage.content}</span>
                    </div>
                )}
                <div className="flex items-start gap-3">
                    <Avatar className="w-10 h-10">
                        <AvatarImage
                            src={message.author.avatar ?
                                `https://cdn.discordapp.com/avatars/${message.author.id}/${message.author.avatar}.png` :
                                undefined
                            }
                            alt={message.author.username}
                        />
                        <AvatarFallback className="bg-gray-600 text-white">
                            {message.author.username.charAt(0).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0 max-w-3xl">
                        <div className="flex items-baseline gap-2 mb-1">
                            <span className="font-medium text-white">{message.author.username}</span>
                            <span className="text-xs text-gray-400">
                {new Date(message.timestamp).toLocaleTimeString()}
              </span>
                            {isPing && <Badge variant="secondary" className="text-xs bg-yellow-500/20 text-yellow-400">Mention</Badge>}
                        </div>
                        <div
                            className="text-gray-200 break-words"
                            dangerouslySetInnerHTML={{ __html: formatMessage(message.content) }}
                        />
                        {message.embeds?.map((embed, idx) => (
                            <Card key={idx} className="mt-2 border-l-4 border-blue-500 bg-gray-800/50 border-gray-700">
                                <CardContent className="p-3">
                                    {embed.title && <div className="font-semibold text-blue-400 mb-1">{embed.title}</div>}
                                    {embed.description && <div className="text-sm text-gray-300">{embed.description}</div>}
                                    {embed.url && (
                                        <Button variant="link" size="sm" className="p-0 h-auto text-blue-400" asChild>
                                            <a href={embed.url} target="_blank" rel="noopener noreferrer">
                                                <ExternalLink className="w-3 h-3 mr-1" />
                                                View
                                            </a>
                                        </Button>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setReplyingTo(message)}
                            className="h-8 w-8 p-0 hover:bg-gray-700"
                        >
                            <Reply className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </div>
        );
    };

    if (!user) {
        return (
            <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
                <Card className="w-full max-w-md bg-gray-800 border-gray-700">
                    <CardHeader className="text-center">
                        <CardTitle className="text-3xl font-bold text-white">KowKord</CardTitle>
                        <CardDescription className="text-gray-400">Lightweight Discord Client</CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-4">
                        {error && (
                            <Alert variant="destructive" className="bg-red-900/50 border-red-800">
                                <AlertDescription className="text-red-200">{error}</AlertDescription>
                            </Alert>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="token" className="text-gray-300">Discord User Token</Label>
                            <Input
                                id="token"
                                type="password"
                                value={token}
                                onChange={(e) => setToken(e.target.value)}
                                placeholder="Enter your user token..."
                                onKeyPress={(e) => e.key === 'Enter' && login()}
                                className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                            />
                        </div>

                        <Button
                            onClick={login}
                            disabled={isLoading || !token}
                            className="w-full bg-blue-600 hover:bg-blue-700"
                        >
                            {isLoading ? 'Connecting...' : 'Connect'}
                        </Button>

                        <div className="text-xs text-gray-400 text-center">
                            Use your Discord user token. You can find it in Developer Tools → Network → Authorization header.
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="h-screen bg-gray-900 text-white flex max-w-screen-2xl mx-auto border-x border-gray-700">
            {/* Server List */}
            <div className="w-16 bg-gray-950 flex flex-col items-center py-3 space-y-2 border-r border-gray-700">
                <Button
                    variant={selectedGuild === 'dm' ? 'default' : 'ghost'}
                    size="icon"
                    onClick={() => selectGuild('dm')}
                    className={`w-12 h-12 rounded-full ${selectedGuild === 'dm' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-700 hover:bg-gray-600'}`}
                >
                    <MessageSquare className="w-6 h-6" />
                </Button>

                <Separator className="w-8 bg-gray-600" />

                <ScrollArea className="flex-1 w-full">
                    <div className="flex flex-col items-center space-y-2 px-2">
                        {guilds.map((guild) => (
                            <Button
                                key={guild.id}
                                variant="ghost"
                                size="icon"
                                onClick={() => selectGuild(guild.id)}
                                className={`w-12 h-12 rounded-full p-0 overflow-hidden hover:bg-gray-700 ${
                                    selectedGuild === guild.id ? 'ring-2 ring-blue-500' : 'hover:rounded-lg'
                                }`}
                            >
                                {guild.icon ? (
                                    <img
                                        src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`}
                                        alt={guild.name}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full bg-gray-600 flex items-center justify-center text-white font-semibold">
                                        {guild.name.charAt(0)}
                                    </div>
                                )}
                            </Button>
                        ))}
                    </div>
                </ScrollArea>
            </div>

            {/* Channel List */}
            <div className="w-60 bg-gray-800 flex flex-col border-r border-gray-700">
                <div className="h-12 px-4 flex items-center justify-between border-b border-gray-700 bg-gray-850">
                    <h2 className="font-semibold text-white truncate">
                        {selectedGuild === 'dm' ? 'Direct Messages' :
                            guilds.find(g => g.id === selectedGuild)?.name || 'Select Server'}
                    </h2>
                    <Button variant="ghost" size="icon" onClick={logout} className="h-8 w-8 hover:bg-gray-700">
                        <LogOut className="w-4 h-4" />
                    </Button>
                </div>

                <ScrollArea className="flex-1" style={{ maxHeight: 'calc(100vh - 3rem)' }}>
                    {selectedGuild === 'dm' ? (
                        <div className="p-2 space-y-1">
                            {dmChannels.map((channel) => {
                                const displayInfo = getChannelDisplayInfo(channel);
                                return (
                                    <Button
                                        key={channel.id}
                                        variant={selectedChannel === channel.id ? 'secondary' : 'ghost'}
                                        onClick={() => selectChannel(channel.id)}
                                        className={`w-full justify-start h-auto p-2 ${
                                            selectedChannel === channel.id ? 'bg-gray-700' : 'hover:bg-gray-700'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 w-full">
                                            <Avatar className="w-8 h-8">
                                                <AvatarImage src={displayInfo.avatar} />
                                                <AvatarFallback className="bg-gray-600 text-white">
                                                    {displayInfo.fallback}
                                                </AvatarFallback>
                                            </Avatar>
                                            <span className="truncate text-left text-gray-200">
                        {displayInfo.name}
                      </span>
                                        </div>
                                    </Button>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="p-2 space-y-1">
                            {channels.map((channel) => (
                                <Button
                                    key={channel.id}
                                    variant={selectedChannel === channel.id ? 'secondary' : 'ghost'}
                                    onClick={() => selectChannel(channel.id)}
                                    className={`w-full justify-start gap-2 ${
                                        selectedChannel === channel.id ? 'bg-gray-700' : 'hover:bg-gray-700'
                                    }`}
                                >
                                    {channel.type === 0 ? (
                                        <Hash className="w-4 h-4 text-gray-400" />
                                    ) : (
                                        <Volume2 className="w-4 h-4 text-gray-400" />
                                    )}
                                    <span className="truncate text-gray-200">{channel.name}</span>
                                </Button>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </div>

            {/* Messages */}
            <div className="flex-1 flex flex-col">
                {selectedChannel ? (
                    <>
                        {/* Messages Header */}
                        <div className="h-12 px-4 flex items-center border-b border-gray-700 bg-gray-850">
                            <Hash className="w-5 h-5 text-gray-400 mr-2" />
                            <span className="font-semibold text-white">
                {selectedGuild === 'dm' ?
                    getChannelDisplayInfo(dmChannels.find(c => c.id === selectedChannel) || {}).name :
                    channels.find(c => c.id === selectedChannel)?.name || 'Channel'
                }
              </span>
                        </div>

                        {/* Messages List */}
                        <ScrollArea
                            className="flex-1"
                            style={{ maxHeight: 'calc(100vh - 9rem)' }}
                            onScrollCapture={handleScroll}
                            ref={messagesContainerRef}
                        >
                            <div className="space-y-0">
                                {isLoadingMessages && (
                                    <div className="text-center py-2 text-gray-400">Loading more messages...</div>
                                )}
                                {messages.map((message) => (
                                    <MessageComponent key={message.id} message={message} />
                                ))}
                                <div ref={messagesEndRef} />
                            </div>
                        </ScrollArea>

                        {/* Reply Preview */}
                        {replyingTo && (
                            <div className="px-4 py-2 bg-gray-800/50 border-l-4 border-gray-600 flex items-center justify-between">
                                <div className="flex items-center gap-2 text-sm text-gray-400">
                                    <Reply className="w-4 h-4" />
                                    <span>Replying to <strong className="text-gray-300">{replyingTo.author.username}</strong></span>
                                    <span className="truncate max-w-md">{replyingTo.content}</span>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setReplyingTo(null)}
                                    className="h-6 w-6 p-0 hover:bg-gray-700"
                                >
                                    ×
                                </Button>
                            </div>
                        )}

                        {/* Message Input */}
                        <div className="p-4 border-t border-gray-700">
                            <div className="flex gap-2">
                                <Input
                                    value={messageInput}
                                    onChange={(e) => setMessageInput(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                                    className="flex-1 bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                                    placeholder={`Message ${selectedGuild === 'dm' ?
                                        getChannelDisplayInfo(dmChannels.find(c => c.id === selectedChannel) || {}).name :
                                        channels.find(c => c.id === selectedChannel)?.name || 'channel'
                                    }`}
                                />
                                <Button
                                    onClick={sendMessage}
                                    disabled={!messageInput.trim()}
                                    size="icon"
                                    className="bg-blue-600 hover:bg-blue-700"
                                >
                                    <Send className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-center">
                            <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-400 opacity-50" />
                            <h3 className="text-xl font-semibold mb-2 text-white">Welcome to KowKord</h3>
                            <p className="text-gray-400">Select a server and channel to start messaging</p>
                        </div>
                    </div>
                )}
            </div>

            {error && (
                <div className="absolute bottom-4 right-4">
                    <Alert variant="destructive" className="max-w-sm bg-red-900/50 border-red-800">
                        <AlertDescription className="text-red-200">{error}</AlertDescription>
                    </Alert>
                </div>
            )}
        </div>
    );
};

export default KowKord;