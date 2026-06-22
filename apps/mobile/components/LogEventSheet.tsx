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
import { useTheme } from '../hooks/useTheme';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function LogEventSheet({ visible, onClose }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [label, setLabel] = useState('');
  const [notes, setNotes] = useState('');
  const inputRef = useRef<TextInput>(null);
  const createEvent = useMutation(api.events.createEventEntry);
  const s = styles(theme);

  async function handleLog() {
    const trimmed = label.trim();
    if (!trimmed) return;
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await createEvent({
      label: trimmed,
      notes: notes.trim() || undefined,
      loggedAt: Date.now(),
    });
    setLabel('');
    setNotes('');
    onClose();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      onShow={() => setTimeout(() => inputRef.current?.focus(), 100)}
    >
      <Pressable style={s.backdrop} onPress={() => { Keyboard.dismiss(); onClose(); }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={s.sheetWrap}
      >
        <View style={[s.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={s.handle} />
          <Text style={s.heading}>Log Event</Text>

          <TextInput
            ref={inputRef}
            style={s.input}
            placeholder="What happened?"
            placeholderTextColor={theme.inkFaint}
            value={label}
            onChangeText={setLabel}
            returnKeyType="next"
          />

          <TextInput
            style={s.notesInput}
            placeholder="Notes (optional)"
            placeholderTextColor={theme.inkFaint}
            value={notes}
            onChangeText={setNotes}
            multiline
            textAlignVertical="top"
          />

          <View style={s.actions}>
            <Pressable style={s.cancelBtn} onPress={onClose}>
              <Text style={s.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[s.createBtn, !label.trim() && s.createBtnDisabled]}
              onPress={handleLog}
              disabled={!label.trim()}
            >
              <Text style={s.createText}>Log</Text>
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
    },
    handle: {
      width: 36, height: 4, borderRadius: 2,
      backgroundColor: theme.lineStrong,
      alignSelf: 'center', marginBottom: 4,
    },
    heading: { fontSize: 17, fontWeight: '700', color: theme.ink },
    input: {
      backgroundColor: theme.surfaceMuted,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      color: theme.ink,
    },
    notesInput: {
      backgroundColor: theme.surfaceMuted,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      color: theme.ink,
      minHeight: 80,
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
