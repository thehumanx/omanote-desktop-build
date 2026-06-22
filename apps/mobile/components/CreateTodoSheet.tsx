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

export function CreateTodoSheet({ visible, onClose }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<'normal' | 'high'>('normal');
  const inputRef = useRef<TextInput>(null);
  const createTodo = useMutation(api.todos.createTodo);
  const s = styles(theme);

  async function handleCreate() {
    const trimmed = title.trim();
    if (!trimmed) return;
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await createTodo({ title: trimmed, createdDateKey: todayKey(), priority });
    setTitle('');
    setPriority('normal');
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
          <Text style={s.heading}>New Todo</Text>

          <TextInput
            ref={inputRef}
            style={s.input}
            placeholder="What needs to be done?"
            placeholderTextColor={theme.inkFaint}
            value={title}
            onChangeText={setTitle}
            onSubmitEditing={handleCreate}
            returnKeyType="done"
            multiline={false}
          />

          <View style={s.priorityRow}>
            <Text style={s.label}>Priority</Text>
            <View style={s.priorityBtns}>
              {(['normal', 'high'] as const).map((p) => (
                <Pressable
                  key={p}
                  style={[s.priorityBtn, priority === p && s.priorityBtnActive]}
                  onPress={() => setPriority(p)}
                >
                  <Text style={[s.priorityBtnText, priority === p && s.priorityBtnTextActive]}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={s.actions}>
            <Pressable style={s.cancelBtn} onPress={onClose}>
              <Text style={s.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[s.createBtn, !title.trim() && s.createBtnDisabled]}
              onPress={handleCreate}
              disabled={!title.trim()}
            >
              <Text style={s.createText}>Add Todo</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function styles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
    },
    sheetWrap: {
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 20,
      paddingTop: 12,
      gap: 16,
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.lineStrong,
      alignSelf: 'center',
      marginBottom: 4,
    },
    heading: {
      fontSize: 17,
      fontWeight: '700',
      color: theme.ink,
    },
    input: {
      backgroundColor: theme.surfaceMuted,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      color: theme.ink,
    },
    label: { fontSize: 13, color: theme.inkMuted, fontWeight: '500' },
    priorityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    priorityBtns: { flexDirection: 'row', gap: 8 },
    priorityBtn: {
      borderRadius: 8,
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderWidth: 1,
      borderColor: theme.line,
    },
    priorityBtnActive: {
      backgroundColor: theme.actionPrimary,
      borderColor: theme.actionPrimary,
    },
    priorityBtnText: { fontSize: 13, color: theme.inkMuted },
    priorityBtnTextActive: { color: theme.actionPrimaryInk, fontWeight: '600' },
    actions: { flexDirection: 'row', gap: 10 },
    cancelBtn: {
      flex: 1,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.line,
    },
    cancelText: { fontSize: 15, color: theme.inkMuted, fontWeight: '500' },
    createBtn: {
      flex: 2,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      backgroundColor: theme.actionPrimary,
    },
    createBtnDisabled: { opacity: 0.4 },
    createText: { fontSize: 15, color: theme.actionPrimaryInk, fontWeight: '600' },
  });
}
