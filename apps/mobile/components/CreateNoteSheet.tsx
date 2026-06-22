import { useMutation } from 'convex/react';
import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../lib/api';
import { todayKey } from '../lib/utils';
import { useTheme } from '../hooks/useTheme';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function CreateNoteSheet({ visible, onClose }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const bodyRef = useRef<TextInput>(null);
  const createNote = useMutation(api.notes.createNote);
  const s = styles(theme);

  async function handleCreate() {
    const trimmedBody = body.trim();
    if (!trimmedBody) return;
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await createNote({
      title: title.trim() || undefined,
      body: trimmedBody,
      dateKey: todayKey(),
      tags: [],
    });
    setTitle('');
    setBody('');
    onClose();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      onShow={() => setTimeout(() => bodyRef.current?.focus(), 100)}
    >
      <Pressable style={s.backdrop} onPress={() => { Keyboard.dismiss(); onClose(); }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={s.sheetWrap}
      >
        <View style={[s.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={s.handle} />
          <Text style={s.heading}>New Note</Text>

          <TextInput
            style={s.titleInput}
            placeholder="Title (optional)"
            placeholderTextColor={theme.inkFaint}
            value={title}
            onChangeText={setTitle}
            returnKeyType="next"
            onSubmitEditing={() => bodyRef.current?.focus()}
          />

          <TextInput
            ref={bodyRef}
            style={s.bodyInput}
            placeholder="Start writing…"
            placeholderTextColor={theme.inkFaint}
            value={body}
            onChangeText={setBody}
            multiline
            textAlignVertical="top"
          />

          <View style={s.actions}>
            <Pressable style={s.cancelBtn} onPress={onClose}>
              <Text style={s.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[s.createBtn, !body.trim() && s.createBtnDisabled]}
              onPress={handleCreate}
              disabled={!body.trim()}
            >
              <Text style={s.createText}>Save Note</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function styles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
    sheetWrap: { justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 20,
      paddingTop: 12,
      gap: 12,
      maxHeight: '85%',
    },
    handle: {
      width: 36, height: 4, borderRadius: 2,
      backgroundColor: theme.lineStrong,
      alignSelf: 'center', marginBottom: 4,
    },
    heading: { fontSize: 17, fontWeight: '700', color: theme.ink },
    titleInput: {
      backgroundColor: theme.surfaceMuted,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 16,
      color: theme.ink,
    },
    bodyInput: {
      backgroundColor: theme.surfaceMuted,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      color: theme.ink,
      minHeight: 120,
    },
    actions: { flexDirection: 'row', gap: 10 },
    cancelBtn: {
      flex: 1, borderRadius: 12, paddingVertical: 14,
      alignItems: 'center', borderWidth: 1, borderColor: theme.line,
    },
    cancelText: { fontSize: 15, color: theme.inkMuted, fontWeight: '500' },
    createBtn: {
      flex: 2, borderRadius: 12, paddingVertical: 14,
      alignItems: 'center', backgroundColor: theme.actionPrimary,
    },
    createBtnDisabled: { opacity: 0.4 },
    createText: { fontSize: 15, color: theme.actionPrimaryInk, fontWeight: '600' },
  });
}
